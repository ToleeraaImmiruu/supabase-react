import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

const TABLE = "products"; // must match your real table name

function formatPrice(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function ProductsPage() {
  const { user, role, isAdmin, signOut } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Can this user change this product? (owner or admin)
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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // CREATE (user_id is filled in automatically by the database)
  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    const price = Number(newPrice);

    if (!name) {
      setNotice({ type: "error", text: "Enter a product name." });
      return;
    }
    if (newPrice === "" || Number.isNaN(price) || price < 0) {
      setNotice({ type: "error", text: "Enter a price of 0 or more." });
      return;
    }

    setAdding(true);
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name, price })
      .select()
      .single();
    setAdding(false);

    if (error) {
      setNotice({ type: "error", text: `Could not add product: ${error.message}` });
      return;
    }

    setProducts((current) => [...current, data]);
    setNewName("");
    setNewPrice("");
    setNotice({ type: "success", text: `Added "${data.name}".` });
  }

  // UPDATE
  function startEdit(product) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPrice(String(product.price));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
  }

  async function handleSave(id) {
    const name = editName.trim();
    const price = Number(editPrice);

    if (!name) {
      setNotice({ type: "error", text: "Enter a product name." });
      return;
    }
    if (editPrice === "" || Number.isNaN(price) || price < 0) {
      setNotice({ type: "error", text: "Enter a price of 0 or more." });
      return;
    }

    setSavingId(id);
    const { data, error } = await supabase
      .from(TABLE)
      .update({ name, price })
      .eq("id", id)
      .select();
    setSavingId(null);

    if (error) {
      setNotice({ type: "error", text: `Could not save changes: ${error.message}` });
      return;
    }
    if (!data || data.length === 0) {
      setNotice({
        type: "error",
        text: "Not saved. You can only edit your own products.",
      });
      return;
    }

    setProducts((current) =>
      current.map((item) => (item.id === id ? data[0] : item))
    );
    cancelEdit();
    setNotice({ type: "success", text: `Saved "${data[0].name}".` });
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

    setProducts((current) => current.filter((item) => item.id !== product.id));
    if (editingId === product.id) cancelEdit();
    setNotice({ type: "success", text: `Deleted "${product.name}".` });
  }

  // Top bar: login / logout
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
    <main className="page">
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

          <button type="submit" className="btn btn--primary" disabled={adding}>
            {adding ? "Adding..." : "Add product"}
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
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Price</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isEditing = editingId === product.id;
                const isSaving = savingId === product.id;
                const isDeleting = deletingId === product.id;
                const busy = isSaving || isDeleting;
                const allowed = canManage(product);

                return (
                  <tr key={product.id} className={busy ? "row row--busy" : "row"}>
                    <td data-label="Name">
                      {isEditing ? (
                        <input
                          aria-label="Product name"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isSaving}
                          autoFocus
                        />
                      ) : (
                        <>
                          {product.name}
                          {user && product.user_id === user.id && (
                            <span className="badge badge--mine">yours</span>
                          )}
                        </>
                      )}
                    </td>

                    <td data-label="Price" className="num">
                      {isEditing ? (
                        <input
                          aria-label="Product price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          disabled={isSaving}
                        />
                      ) : (
                        formatPrice(product.price)
                      )}
                    </td>

                    <td className="actions-col">
                      {!allowed ? null : isEditing ? (
                        <>
                          <button
                            className="btn btn--primary btn--small"
                            onClick={() => handleSave(product.id)}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default ProductsPage;