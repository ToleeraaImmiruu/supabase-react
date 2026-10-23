# Product Manager (React + Supabase)

A full-stack web application for managing products, built with **React**, **Vite** and **Supabase**. Visitors can browse products, while signed-in users can add products with an image and description, and manage their own listings. Admins can manage every product.

**Live demo:** [your-render-link]

## Features

- **Authentication:** sign up and log in with email and password (Supabase Auth)
- **Role-based access:** `user` and `admin` roles stored in a `profiles` table
- **Full CRUD:** create, read, update and delete products
- **Image upload:** product photos stored in Supabase Storage, with a live preview before upload
- **Product descriptions:** up to 500 characters per product
- **Ownership rules:** users can edit and delete only their own products, and admins can manage all
- **Row Level Security:** permissions are enforced in the database, not just in the UI
- **Dynamic UI:** loading states, success and error messages, and instant updates without page reloads
- **Responsive design:** card grid that adapts to phones, tablets and desktops

## How permissions work

| Visitor | View products | Add | Edit / delete |
|---|---|---|---|
| Logged out | Yes | No | No |
| Logged-in user | Yes | Yes | Own products only |
| Admin | Yes | Yes | All products |

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, React Router |
| Backend | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Styling | Plain CSS |
| Hosting | Render (static site) |

## Project structure

```
src/
  App.jsx            Routes and providers
  AuthContext.jsx    Login state and user role
  AuthPage.jsx       Login and sign-up page
  ProductsPage.jsx   Product list, add, edit, delete, image upload
  supabaseClient.js  Supabase connection
  App.css            Styles
```

## How it works

1. The user logs in and Supabase returns a token.
2. `AuthContext` stores the user and loads their role from the `profiles` table.
3. The UI shows or hides actions based on the role and product ownership.
4. Every request carries the token, and PostgreSQL policies (RLS) decide what is allowed.
5. Images are uploaded to a Supabase Storage bucket, and the product row stores the image URL and path.

## Getting started

### Prerequisites

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project

### Installation

```bash
git clone [your-repo-url]
cd [your-project-folder]
npm install
```

### Environment variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Use only the **anon** key. Never put the `service_role` key in the frontend.

### Database setup

Run the SQL for these parts in the Supabase SQL Editor:

1. The `products` table (`id`, `name`, `price`, `description`, `image_url`, `image_path`, `user_id`)
2. The `profiles` table with a `role` column and a trigger that creates a profile on sign-up
3. Row Level Security policies for `products`
4. A public `product-images` Storage bucket with its policies

### Run locally

```bash
npm run dev
```

Open `http://localhost:5173`.

### Create an admin

Sign up in the app, then run this in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

## Deployment (Render)

1. Create a new **Static Site** on Render and connect this repository.
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. Add the two `VITE_` environment variables.
5. Add a rewrite rule: `/*` to `/index.html` (action: Rewrite).
6. In Supabase, set **Authentication → URL Configuration** to your Render address.

## Security notes

- Permissions are enforced by Row Level Security in PostgreSQL.
- Users cannot change their own role, because the `profiles` table has no update policy.
- Image uploads are limited by the bucket to 5 MB and to JPG, PNG, WebP and GIF types.

## Possible improvements

- Search and filtering
- Multiple images per product
- Password reset
- Realtime updates
- Image compression before upload

## License

MIT
