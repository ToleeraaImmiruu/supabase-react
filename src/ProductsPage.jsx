import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

const TABLE = "products"; // must match your real table name
const BUCKET = "product-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function formatPrice(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// Returns an error message, or "" if the file is fine
function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Use a JPG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_SIZE) {
    return "The image must be 5 MB or smaller.";
  }
  return "";
}

// Upload a file to Storage and return its path and public URL
async function uploadImage(file, userId) {
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

// Delete a file from Storage (never crash the app if it fails)
async function removeImage(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn("Could not remove image:", error.message);
}

function ProductsPage() {
  const { user, role, isAdmin, signOut } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  // Add form
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [newPreview, setNewPreview] = useState("");
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef(null);

  // Edit
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  function canManage(product) {
    return Boolean(user) && (isAdmin || product.user_id === user.id);
  }

  // READ
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select("*")
          .order("id");

        if (error) setError(error.message);
        else setProducts(data);
      } catch (err) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Auto-hide notices
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Local preview for the add form's chosen file
  useEffect(() => {
    if (!newFile) {
      setNewPreview("");
      return;
    }
    const url = URL.createObjectURL(newFile);
    setNewPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newFile]);

  // Local preview for the edit form's chosen file
  useEffect(() => {
    if (!editFile) {
      setEditPreview("");
      return;
    }
    const url = URL.createObjectURL(editFile);
    setEditPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editFile]);

  function handleNewFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const message = validateImage(file);
    if (message) {
      setNotice({ type: "error", text: message });
      e.target.value = "";
      return;
    }
    setNewFile(file);
  }

  function handleEditFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const message = validateImage(file);
    if (message) {
      setNotice({ type: "error", text: message });
      e.target.value = "";
      return;
    }
    setEditFile(file);
    setRemoveCurrentImage(false);
  }

  // CREATE
  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    const price = Number(newPrice);
    const description = newDescription.trim();

    if (!name) {
      setNotice({ type: "error", text: "Enter a product name." });
      return;
    }
    if (newPrice === "" || Number.isNaN(price) || price < 0) {
      setNotice({ type: "error", text: "Enter a price of 0 or more." });
      return;
    }

    setAdding(true);
    let uploaded = null;

    try {
      // 1. Upload the image first (if one was chosen)
      if (newFile) uploaded = await uploadImage(newFile, user.id);

      // 2. Save the row with the image URL and path
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          name,
          price,
          description: description || null,
          image_url: uploaded?.url ?? null,
          image_path: uploaded?.path ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      setProducts((current) => [...current, data]);
      setNewName("");
      setNewPrice("");
      setNewDescription("");
      setNewFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice({ type: "success", text: `Added "${data.name}".` });
    } catch (err) {
      // If the row failed, remove the file we just uploaded
      if (uploaded) await removeImage(uploaded.path);
      setNotice({ type: "error", text: `Could not add product: ${err.message}` });
    } finally {
      setAdding(false);
    }
  }

  // UPDATE
  function startEdit(product) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPrice(String(product.price));
    setEditDescription(product.description ?? "");
    setEditFile(null);
    setRemoveCurrentImage(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditDescription("");
    setEditFile(null);
    setRemoveCurrentImage(false);
  }

  async function handleSave(product) {
    const name = editName.trim();
    const price = Number(editPrice);
    const description = editDescription.trim();

    if (!name) {
      setNotice({ type: "error", text: "Enter a product name." });
      return;
    }
    if (editPrice === "" || Number.isNaN(price) || price < 0) {
      setNotice({ type: "error", text: "Enter a price of 0 or more." });
      return;
    }

    setSavingId(product.id);
    let uploaded = null;

    try {
      const changes = { name, price, description: description || null };

      if (editFile) {
        // Upload under the CURRENT user's folder (required by the policy)
        uploaded = await uploadImage(editFile, user.id);
        changes.image_url = uploaded.url;
        changes.image_path = uploaded.path;
      } else if (removeCurrentImage) {
        changes.image_url = null;
        changes.image_path = null;
      }

      const { data, error } = await supabase
        .from(TABLE)
        .update(changes)
        .eq("id", product.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Not saved. You can only edit your own products.");
      }

      // The row now points to the new image, so delete the old file
      if ((uploaded || removeCurrentImage) && product.image_path) {
        await removeImage(product.image_path);
      }

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? data[0] : item))
      );
      cancelEdit();
      setNotice({ type: "success", text: `Saved "${data[0].name}".` });
    } catch (err) {
      if (uploaded) await removeImage(uploaded.path);
      setNotice({ type: "error", text: `Could not save changes: ${err.message}` });
    } finally {
      setSavingId(null);
    }
  }

  // DELETE
  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    setDeletingId(product.id);
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", product.id)
      .select();
    setDeletingId(null);

    if (error) {
      setNotice({ type: "error", text: `Could not delete product: ${error.message}` });
      return;
    }
    if (!data || data.length === 0) {
      setNotice({
        type: "error",
        text: "Not deleted. You can only delete your own products.",
      });
      return;
    }

    // The row is gone, so remove its image file too
    await removeImage(data[0].image_path);

    setProducts((current) => current.filter((item) => item.id !== product.id));
    if (editingId === product.id) cancelEdit();
    setNotice({ type: "success", text: `Deleted "${product.name}".` });
  }

  const topBar = (
    <div className="topbar">
      {user ? (
        <>
          <span className="who">
            {user.email} <span className={`badge badge--${role}`}>{role}</span>
          </span>
          <button className="btn btn--small" onClick={signOut}>
            Log out
          </button>
        </>
      ) : (
        <Link className="btn btn--primary btn--small" to="/login">
          Log in
        </Link>
      )}
    </div>
  );

  if (loading) {
    return (
      <main className="page">
        <div className="status-box" role="status">
          <span className="spinner" aria-hidden="true" />
          Loading products...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <div className="status-box status-box--error" role="alert">
          Could not load products: {error}
        </div>
      </main>
    );
  }

  return (
    <main className="page page--wide">
      {topBar}

      <header className="page-header">
        <h1>Products</h1>
        <p className="count">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
      </header>

      {notice && (
        <div className={`notice notice--${notice.type}`} role="status">
          {notice.text}
        </div>
      )}

      {/* Add form: only for logged-in users */}
      {user ? (
        <form className="add-form" onSubmit={handleAdd}>
          <div className="field">
            <label htmlFor="new-name">Name</label>
            <input
              id="new-name"
              type="text"
              placeholder="Mechanical keyboard"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={adding}
            />
          </div>

          <div className="field field--price">
            <label htmlFor="new-price">Price (USD)</label>
            <input
              id="new-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="49.99"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={adding}
            />
          </div>

          <div className="field field--wide">
            <label htmlFor="new-description">Description</label>
            <textarea
              id="new-description"
              rows="3"
              maxLength={500}
              placeholder="Tell people about this product..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              disabled={adding}
            />
            <span className="form-hint">{newDescription.length}/500</span>
          </div>

          <div className="field field--wide">
            <label htmlFor="new-image">Image (JPG, PNG, WebP or GIF, up to 5 MB)</label>
            <div className="preview-row">
              <input
                id="new-image"
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleNewFile}
                disabled={adding}
              />
              {newPreview && (
                <img className="preview-thumb" src={newPreview} alt="Selected preview" />
              )}
            </div>
          </div>

          <button type="submit" className="btn btn--primary" disabled={adding}>
            {adding ? (newFile ? "Uploading..." : "Adding...") : "Add product"}
          </button>
        </form>
      ) : (
        <div className="login-prompt">
          <Link to="/login">Log in</Link> to add and manage your own products.
        </div>
      )}

      {products.length === 0 ? (
        <div className="empty">
          <p>No products yet.</p>
          <p>{user ? "Use the form above to add the first one." : "Log in to add the first one."}</p>
        </div>
      ) : (
        <div className="grid">
          {products.map((product) => {
            const isEditing = editingId === product.id;
            const isSaving = savingId === product.id;
            const isDeleting = deletingId === product.id;
            const busy = isSaving || isDeleting;
            const allowed = canManage(product);

            // Which image to show in the card
            const shownImage = isEditing
              ? editPreview || (removeCurrentImage ? "" : product.image_url)
              : product.image_url;

            return (
              <article key={product.id} className={busy ? "card card--busy" : "card"}>
                <div className="card-media">
                  {shownImage ? (
                    <img src={shownImage} alt={product.name} loading="lazy" />
                  ) : (
                    <div className="card-noimg">No image</div>
                  )}
                </div>

                <div className="card-body">
                  {isEditing ? (
                    <>
                      <input
                        aria-label="Product name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isSaving}
                        autoFocus
                      />
                      <input
                        aria-label="Product price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        disabled={isSaving}
                      />
                      <textarea
                        aria-label="Product description"
                        rows="3"
                        maxLength={500}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        disabled={isSaving}
                      />

                      <div className="image-controls">
                        <label className="btn btn--small file-btn">
                          {shownImage ? "Change image" : "Choose image"}
                          <input
                            type="file"
                            accept={ALLOWED_TYPES.join(",")}
                            onChange={handleEditFile}
                            disabled={isSaving}
                            hidden
                          />
                        </label>

                        {product.image_url && !removeCurrentImage && !editFile && (
                          <button
                            type="button"
                            className="btn btn--danger btn--small"
                            onClick={() => setRemoveCurrentImage(true)}
                            disabled={isSaving}
                          >
                            Remove image
                          </button>
                        )}

                        {(editFile || removeCurrentImage) && (
                          <button
                            type="button"
                            className="btn btn--small"
                            onClick={() => {
                              setEditFile(null);
                              setRemoveCurrentImage(false);
                            }}
                            disabled={isSaving}
                          >
                            Undo image change
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="card-head">
                        <h2 className="card-title">{product.name}</h2>
                        <span className="card-price">{formatPrice(product.price)}</span>
                      </div>
                      {product.description && (
                        <p className="card-desc">{product.description}</p>
                      )}
                      {user && product.user_id === user.id && (
                        <span className="badge badge--mine badge--inline">yours</span>
                      )}
                    </>
                  )}
                </div>

                {allowed && (
                  <div className="card-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="btn btn--primary btn--small"
                          onClick={() => handleSave(product)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="btn btn--small"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn--small"
                          onClick={() => startEdit(product)}
                          disabled={busy || editingId !== null}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--danger btn--small"
                          onClick={() => handleDelete(product)}
                          disabled={busy || editingId !== null}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default ProductsPage;