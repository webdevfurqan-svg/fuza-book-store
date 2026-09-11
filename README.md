# 📚 FUZA Book Store

A lightweight, high-performance web application for browsing, searching, and downloading digital books. Features an administrative backend to upload and manage PDFs and cover assets seamlessly integrated with Cloudinary for serverless storage.

---

## ✨ Features

* **Book Catalog & Live Search:** Browse the collection and filter titles instantly by key search terms.
* **Download Counter:** Tracks total download metrics dynamically whenever a book PDF is accessed.
* **Admin Dashboard:** Password-protected dashboard to upload new books and delete existing titles from the store.
* **Direct Cloud Storage:** Uploads PDFs and cover images directly from the browser to Cloudinary, completely bypassing serverless body limits.

---

## 🛠️ Tech Stack

* **Frontend:** EJS Templating, Custom CSS3, Modern JavaScript (Fetch API)
* **Backend:** Node.js, Express.js
* **Database & Sessions:** MongoDB Atlas, Mongoose ODM, `connect-mongo`
* **File Storage:** Cloudinary (Unsigned Upload Preset)
* **Deployment:** Vercel

---

## ⚙️ Environment Variables

Add the following environment configuration variables to your local `.env` or Vercel project settings:

```env
MONGO_URI=your_mongodb_atlas_connection_string
SESSION_SECRET=your_secret_session_key
ADMIN_PASSWORD=your_secure_admin_password