const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and parsing of JSON & URL-encoded request bodies
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static HTML/CSS/JS/images from root directory
app.use(express.static(path.join(__dirname)));

// Initialize database tables & default seed data
initDatabase();

// --- Multer File Upload Setup ---
const uploadDir = path.join(__dirname, 'images', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


// --- Auth Middleware ---
// Compares Bearer token against stored admin_password
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Missing authentication token.' });
  }
  const token = authHeader.split(' ')[1];
  
  db.get('SELECT value FROM settings WHERE key = ?', ['admin_password'], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'Database authentication error' });
    }
    if (token !== row.value) {
      return res.status(401).json({ error: 'Unauthorized. Invalid credentials.' });
    }
    next();
  });
}


// ==========================================
// PUBLIC API ENDPOINTS (GET Routes)
// ==========================================

// 1. Get Carousel Slides
app.get('/api/carousel', (req, res) => {
  db.all('SELECT * FROM carousel ORDER BY display_order ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Get All Settings / Global Config
app.get('/api/settings', (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Convert key-value rows to a single JSON object (excluding admin password)
    const settingsObj = {};
    rows.forEach(r => {
      if (r.key !== 'admin_password') {
        settingsObj[r.key] = r.value;
      }
    });
    res.json(settingsObj);
  });
});

// 3. Get Service schedules
app.get('/api/schedules', (req, res) => {
  db.all('SELECT * FROM schedules ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 4. Get Clergy and Committee Personnel
app.get('/api/personnel', (req, res) => {
  db.all('SELECT * FROM personnel ORDER BY display_order ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 5. Get All Organizations
app.get('/api/organizations', (req, res) => {
  db.all('SELECT * FROM organizations', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Parse JSON features for each org
    const formatted = rows.map(r => ({
      ...r,
      features: JSON.parse(r.features || '[]')
    }));
    res.json(formatted);
  });
});

// 6. Get Specific Organization details and its members
app.get('/api/organizations/:slug', (req, res) => {
  const { slug } = req.params;
  db.get('SELECT * FROM organizations WHERE slug = ?', [slug], (err, org) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    
    db.all('SELECT * FROM organization_members WHERE org_slug = ?', [slug], (err2, members) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({
        ...org,
        features: JSON.parse(org.features || '[]'),
        members: members
      });
    });
  });
});

// 7. Get Gallery images
app.get('/api/gallery', (req, res) => {
  db.all('SELECT * FROM gallery ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 8. Get Events
app.get('/api/events', (req, res) => {
  db.all('SELECT * FROM events ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 9. Get Prayer Groups
app.get('/api/prayer-groups', (req, res) => {
  db.all('SELECT * FROM prayer_groups ORDER BY display_order ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// ==========================================
// ADMIN API ENDPOINTS (Auth Required)
// ==========================================

// Login Validation
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }
  
  db.get('SELECT value FROM settings WHERE key = ?', ['admin_password'], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'Database connection failure' });
    }
    if (password === row.value) {
      // Return password as token (for ease of standalone deployment)
      res.json({ success: true, token: password });
    } else {
      res.status(401).json({ error: 'Incorrect password' });
    }
  });
});

// Change Admin Password
app.post('/api/admin/change-password', authMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim() === '') {
    return res.status(400).json({ error: 'New password cannot be empty' });
  }
  
  db.run('UPDATE settings SET value = ? WHERE key = ?', [newPassword, 'admin_password'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Password updated successfully' });
  });
});

// Update Global Settings (Messages/Contacts)
app.post('/api/admin/settings', authMiddleware, upload.fields([
  { name: 'archbishop_image', maxCount: 1 },
  { name: 'vicar_image', maxCount: 1 }
]), (req, res) => {
  const updates = { ...req.body };
  
  // Add uploaded file paths to settings if present
  if (req.files) {
    if (req.files.archbishop_image) {
      updates.archbishop_image = 'images/uploads/' + req.files.archbishop_image[0].filename;
    }
    if (req.files.vicar_image) {
      updates.vicar_image = 'images/uploads/' + req.files.vicar_image[0].filename;
    }
  }

  db.serialize(() => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    Object.keys(updates).forEach(key => {
      stmt.run(key, updates[key]);
    });
    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Settings saved successfully' });
    });
  });
});

// --- Personnel CRUD ---

// Add Personnel member
app.post('/api/admin/personnel', authMiddleware, upload.single('image'), (req, res) => {
  const { name, role, description, phone, email, category, display_order } = req.body;
  const imagePath = req.file ? 'images/uploads/' + req.file.filename : 'images/person1.jpg'; // default placeholder

  db.run(
    `INSERT INTO personnel (name, role, description, phone, email, image_path, category, display_order) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, role, description, phone, email, imagePath, category, display_order || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Edit Personnel member
app.put('/api/admin/personnel/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, role, description, phone, email, category, display_order } = req.body;
  
  if (req.file) {
    // If a new image was uploaded
    const imagePath = 'images/uploads/' + req.file.filename;
    db.run(
      `UPDATE personnel SET name = ?, role = ?, description = ?, phone = ?, email = ?, image_path = ?, category = ?, display_order = ? 
       WHERE id = ?`,
      [name, role, description, phone, email, imagePath, category, display_order || 0, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    // If image was not changed
    db.run(
      `UPDATE personnel SET name = ?, role = ?, description = ?, phone = ?, email = ?, category = ?, display_order = ? 
       WHERE id = ?`,
      [name, role, description, phone, email, category, display_order || 0, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// Delete Personnel member
app.delete('/api/admin/personnel/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM personnel WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});


// --- schedules CRUD ---

// Add Timing schedule
app.post('/api/admin/schedules', authMiddleware, (req, res) => {
  const { day_name, service_name, service_time } = req.body;
  db.run(
    'INSERT INTO schedules (day_name, service_name, service_time) VALUES (?, ?, ?)',
    [day_name, service_name, service_time],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Edit Timing schedule
app.put('/api/admin/schedules/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { day_name, service_name, service_time } = req.body;
  db.run(
    'UPDATE schedules SET day_name = ?, service_name = ?, service_time = ? WHERE id = ?',
    [day_name, service_name, service_time, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Delete Timing schedule
app.delete('/api/admin/schedules/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM schedules WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});


// --- Organizations CRUD ---

// Update organization description/badge/features
app.put('/api/admin/organizations/:slug', authMiddleware, upload.single('image'), (req, res) => {
  const { slug } = req.params;
  const { badge, description, features } = req.body; // features should be passed as JSON string
  
  if (req.file) {
    const imagePath = 'images/uploads/' + req.file.filename;
    db.run(
      'UPDATE organizations SET badge = ?, description = ?, features = ?, image_path = ? WHERE slug = ?',
      [badge, description, features, imagePath, slug],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      'UPDATE organizations SET badge = ?, description = ?, features = ? WHERE slug = ?',
      [badge, description, features, slug],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// Add member to organization
app.post('/api/admin/organizations/:slug/members', authMiddleware, upload.single('image'), (req, res) => {
  const { slug } = req.params;
  const { name, role, phone } = req.body;
  const imagePath = req.file ? 'images/uploads/' + req.file.filename : 'images/person1.jpg';

  db.run(
    'INSERT INTO organization_members (org_slug, name, role, phone, image_path) VALUES (?, ?, ?, ?, ?)',
    [slug, name, role, phone, imagePath],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Edit organization member
app.put('/api/admin/organizations/members/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, role, phone } = req.body;

  if (req.file) {
    const imagePath = 'images/uploads/' + req.file.filename;
    db.run(
      'UPDATE organization_members SET name = ?, role = ?, phone = ?, image_path = ? WHERE id = ?',
      [name, role, phone, imagePath, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      'UPDATE organization_members SET name = ?, role = ?, phone = ? WHERE id = ?',
      [name, role, phone, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// Delete organization member
app.delete('/api/admin/organizations/members/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM organization_members WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});


// --- Gallery CRUD ---

// Add image to Gallery
app.post('/api/admin/gallery', authMiddleware, upload.single('image'), (req, res) => {
  const { title, category } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'Image file required' });
  }
  const imagePath = 'images/uploads/' + req.file.filename;

  db.run(
    'INSERT INTO gallery (title, category, image_path) VALUES (?, ?, ?)',
    [title, category, imagePath],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Delete image from Gallery
app.delete('/api/admin/gallery/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  // Optionally read image_path to delete the file from storage
  db.get('SELECT image_path FROM gallery WHERE id = ?', [id], (err, row) => {
    if (!err && row) {
      const fullPath = path.join(__dirname, row.image_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath); // Delete the actual file
      }
    }
    
    db.run('DELETE FROM gallery WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});


// --- Carousel CRUD ---

// Add slide to Carousel
app.post('/api/admin/carousel', authMiddleware, upload.single('image'), (req, res) => {
  const { title, description, display_order } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'Image banner file required' });
  }
  const imagePath = 'images/uploads/' + req.file.filename;

  db.run(
    'INSERT INTO carousel (title, description, image_path, display_order) VALUES (?, ?, ?, ?)',
    [title, description, imagePath, display_order || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Delete slide from Carousel
app.delete('/api/admin/carousel/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT image_path FROM carousel WHERE id = ?', [id], (err, row) => {
    if (!err && row) {
      const fullPath = path.join(__dirname, row.image_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    db.run('DELETE FROM carousel WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});


// --- Events CRUD ---

// Add Event
app.post('/api/admin/events', authMiddleware, upload.single('image'), (req, res) => {
  const { title, description, date_text } = req.body;
  const imagePath = req.file ? 'images/uploads/' + req.file.filename : 'images/CHURCH FRONT VIEW.jpg';

  db.run(
    'INSERT INTO events (title, description, date_text, image_path) VALUES (?, ?, ?, ?)',
    [title, description, date_text, imagePath],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Edit Event
app.put('/api/admin/events/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, description, date_text } = req.body;

  if (req.file) {
    const imagePath = 'images/uploads/' + req.file.filename;
    db.run(
      'UPDATE events SET title = ?, description = ?, date_text = ?, image_path = ? WHERE id = ?',
      [title, description, date_text, imagePath, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      'UPDATE events SET title = ?, description = ?, date_text = ? WHERE id = ?',
      [title, description, date_text, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// Delete Event
app.delete('/api/admin/events/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.get('SELECT image_path FROM events WHERE id = ?', [id], (err, row) => {
    if (!err && row && row.image_path) {
      const fullPath = path.join(__dirname, row.image_path);
      if (fs.existsSync(fullPath) && row.image_path.startsWith('images/uploads/')) {
        fs.unlinkSync(fullPath);
      }
    }
    db.run('DELETE FROM events WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// --- Prayer Groups CRUD ---

// Add Prayer Group
app.post('/api/admin/prayer-groups', authMiddleware, upload.single('image'), (req, res) => {
  const { name, leader, coordinator, phone, display_order } = req.body;
  const imagePath = req.file ? 'images/uploads/' + req.file.filename : 'images/person1.jpg';

  db.run(
    'INSERT INTO prayer_groups (name, leader, coordinator, phone, image_path, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [name, leader, coordinator, phone, imagePath, display_order || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Edit Prayer Group
app.put('/api/admin/prayer-groups/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, leader, coordinator, phone, display_order } = req.body;

  if (req.file) {
    const imagePath = 'images/uploads/' + req.file.filename;
    db.run(
      'UPDATE prayer_groups SET name = ?, leader = ?, coordinator = ?, phone = ?, image_path = ?, display_order = ? WHERE id = ?',
      [name, leader, coordinator, phone, imagePath, display_order || 0, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      'UPDATE prayer_groups SET name = ?, leader = ?, coordinator = ?, phone = ?, display_order = ? WHERE id = ?',
      [name, leader, coordinator, phone, display_order || 0, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// Delete Prayer Group
app.delete('/api/admin/prayer-groups/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.get('SELECT image_path FROM prayer_groups WHERE id = ?', [id], (err, row) => {
    if (!err && row && row.image_path) {
      const fullPath = path.join(__dirname, row.image_path);
      if (fs.existsSync(fullPath) && row.image_path.startsWith('images/uploads/')) {
        fs.unlinkSync(fullPath);
      }
    }
    db.run('DELETE FROM prayer_groups WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
