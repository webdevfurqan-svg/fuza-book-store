require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const Book = require('./models/Book');
const requireAdmin = require('./middleware/auth');

const app = express();

let isConnected = false;
async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
  }
}

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // required behind Vercel's proxy for secure cookies

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fuza-book-store-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const uploadsFolder = path.join(__dirname, 'uploads');
const coversFolder = path.join(__dirname, 'public', 'covers');
if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync(uploadsFolder)) fs.mkdirSync(uploadsFolder, { recursive: true });
  if (!fs.existsSync(coversFolder)) fs.mkdirSync(coversFolder, { recursive: true });
}

app.get('/', async (req, res) => {
  try {
    const searchTerm = req.query.search || '';
    let query = {};
    if (searchTerm) {
      query.title = { $regex: searchTerm, $options: 'i' };
    }

    const books = await Book.find(query).sort({ createdAt: -1 });
    res.render('index', { books, searchTerm });
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/download/:id', async (req, res) => {
  const id = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send('Book not found.');
  }

  try {
    const book = await Book.findByIdAndUpdate(
      id,
      { $inc: { downloads: 1 } },
      { new: true }
    );

    if (!book) return res.status(404).send('Book not found.');

    if (book.pdfUrl) {
      return res.redirect(book.pdfUrl);
    }

    const localPdfPath = path.join(uploadsFolder, `${id}.pdf`);
    if (fs.existsSync(localPdfPath)) {
      return res.download(localPdfPath, `${book.title}.pdf`);
    }

    res.status(404).send('Book file not found.');
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Error processing download.');
  }
});

app.get('/admin/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!password) {
    return res.render('login', { error: 'Password is required.' });
  }

  let isMatch = false;
  if (adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')) {
    isMatch = await bcrypt.compare(password, adminPassword);
  } else {
    isMatch = (password === adminPassword);
  }

  if (isMatch) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  res.render('login', { error: 'Incorrect password.' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.render('admin', {
      books,
      error: null,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    });
  } catch (err) {
    res.status(500).send('Error loading admin dashboard');
  }
});

app.post('/admin/upload', requireAdmin, async (req, res) => {
  try {
    const { title, author, coverUrl, pdfUrl } = req.body;

    if (!title || !author) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(400).json({ error: 'Title and author are required.' });
      }
      const books = await Book.find().sort({ createdAt: -1 });
      return res.render('admin', { books, error: 'Title and author are required.' });
    }

    const newBook = await Book.create({
      title,
      author,
      coverUrl: coverUrl || '',
      pdfUrl: pdfUrl || ''
    });

    if (req.headers['content-type'] === 'application/json') {
      return res.status(200).json({ success: true, book: newBook });
    }

    res.redirect('/admin');
  } catch (err) {
    console.error('Upload Error:', err);
    if (req.headers['content-type'] === 'application/json') {
      return res.status(500).json({ error: 'Failed to create book record.' });
    }
    const books = await Book.find().sort({ createdAt: -1 });
    res.render('admin', { books, error: 'Could not create book record.' });
  }
});

app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send('Book not found.');
  }

  try {
    await Book.findByIdAndDelete(id);

    const pdfPath = path.join(uploadsFolder, `${id}.pdf`);
    const coverPath = path.join(coversFolder, `${id}.jpg`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);

    res.redirect('/admin');
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).send('Could not delete book.');
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;