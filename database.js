const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Initialize database schema and migrate data
function initDatabase() {
  db.serialize(() => {
    // 1. Settings Table (Global Config & Messages)
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // 2. Personnel Table (Clergy & Parish Committee)
    db.run(`CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT,
      phone TEXT,
      email TEXT,
      image_path TEXT,
      category TEXT CHECK(category IN ('clergy', 'committee')) NOT NULL,
      display_order INTEGER DEFAULT 0
    )`);

    // 3. Organizations Table
    db.run(`CREATE TABLE IF NOT EXISTS organizations (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      badge TEXT,
      description TEXT,
      features TEXT, -- JSON Array string
      image_path TEXT
    )`);

    // 4. Organization Members Table
    db.run(`CREATE TABLE IF NOT EXISTS organization_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_slug TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      image_path TEXT,
      FOREIGN KEY (org_slug) REFERENCES organizations(slug) ON DELETE CASCADE
    )`);

    // 5. Gallery Table
    db.run(`CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      category TEXT CHECK(category IN ('events', 'building', 'feast')) NOT NULL,
      image_path TEXT NOT NULL
    )`);

    // 6. Schedules Table (Service Timings)
    db.run(`CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_name TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_time TEXT NOT NULL
    )`);

    // 7. Carousel Table (Homepage banner)
    db.run(`CREATE TABLE IF NOT EXISTS carousel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      image_path TEXT NOT NULL,
      display_order INTEGER DEFAULT 0
    )`);

    // 8. Events Table
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date_text TEXT,
      image_path TEXT
    )`);

    // 9. Prayer Groups Table
    db.run(`CREATE TABLE IF NOT EXISTS prayer_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      leader TEXT,
      coordinator TEXT,
      phone TEXT,
      image_path TEXT,
      display_order INTEGER DEFAULT 0
    )`);

    // --- Seeding initial data if settings are empty ---
    db.get('SELECT COUNT(*) AS count FROM settings', [], (err, row) => {
      if (err) {
        console.error('Check settings error:', err.message);
        return;
      }
      if (row.count === 0) {
        console.log('Database empty. Migrating default static site data...');
        seedDefaultData();
      }
    });

    // --- Seeding events if empty ---
    db.get('SELECT COUNT(*) AS count FROM events', [], (err, row) => {
      if (!err && row && row.count === 0) {
        console.log('Events table empty. Seeding default events...');
        const defaultEvents = [
          { title: '90th Anniversary Celebration', description: 'Join us for our 90th anniversary celebration with a special Holy Qurbana, cultural events, and community lunch.', date_text: 'August 15, 2025', image_path: 'images/PERUNNAL_KODIYETT.jpg' },
          { title: 'Sunday School Registration', description: 'Sunday School admissions are now open. Please register at the parish office before July 31.', date_text: 'July 1–31, 2025', image_path: 'images/PERUNNAL_KODIYETT_1.jpg' },
          { title: 'Weekly Holy Qurbana', description: 'Join us every Sunday for the Holy Qurbana (Divine Liturgy) and spiritual fellowship.', date_text: 'Every Sunday', image_path: 'images/CHURCH FRONT VIEW.jpg' }
        ];
        const stmtEvents = db.prepare('INSERT INTO events (title, description, date_text, image_path) VALUES (?, ?, ?, ?)');
        defaultEvents.forEach(e => stmtEvents.run(e.title, e.description, e.date_text, e.image_path));
        stmtEvents.finalize();
      }
    });

    // --- Seeding prayer groups if empty ---
    db.get('SELECT COUNT(*) AS count FROM prayer_groups', [], (err, row) => {
      if (!err && row && row.count === 0) {
        console.log('Prayer groups table empty. Seeding default prayer groups...');
        const defaultGroups = [
          { name: "St. Mary's Prayer Group", leader: 'Anju Thomas', coordinator: 'Jinu Mathew', phone: '+91 98765 43210', image_path: 'images/person1.jpg', display_order: 1 },
          { name: "St. Joseph's Prayer Group", leader: 'Roselin Kurian', coordinator: 'Binu John', phone: '+91 98765 12345', image_path: 'images/parish_vicar.jpg', display_order: 2 },
          { name: "St. Paul's Prayer Group", leader: 'Reena George', coordinator: 'Paul Varghese', phone: '+91 98765 67890', image_path: 'images/catholicos.jpg', display_order: 3 }
        ];
        const stmtGroups = db.prepare('INSERT INTO prayer_groups (name, leader, coordinator, phone, image_path, display_order) VALUES (?, ?, ?, ?, ?, ?)');
        defaultGroups.forEach(g => stmtGroups.run(g.name, g.leader, g.coordinator, g.phone, g.image_path, g.display_order));
        stmtGroups.finalize();
      }
    });
  });
}

function seedDefaultData() {
  // Seed Settings
  const defaultSettings = [
    { key: 'admin_password', value: 'admin123' }, // Default admin panel password
    { key: 'phone', value: '+91-1234567890' },
    { key: 'email', value: 'example@churchmail.com' },
    { key: 'sunday_service', value: 'Sunday Service: 8:00 AM' },
    { key: 'church_address', value: 'Nalanchira, Kerala, India' },
    
    // Archbishop Message
    { key: 'archbishop_name', value: 'His Beatitude Moran Mor Baselios Cleemis Catholicos' },
    { key: 'archbishop_title', value: 'Message of Head of Malankara Catholic Church' },
    { key: 'archbishop_subtitle', value: 'Major Archbishop Catholicos of Malankara Syrian Catholic Church and Trivandrum Major Archdiocese' },
    { key: 'archbishop_image', value: 'images/catholicos.jpg' },
    { key: 'archbishop_message', value: "Dear beloved faithful of St. Thomas Malankara Syrian Catholic Church, Nalanchira, I extend my apostolic blessings to your parish community. May this sacred place continue to be a beacon of faith, hope, and love, where all who enter find spiritual nourishment and divine grace. Let us remain united in prayer and service, carrying forward the rich traditions of our Malankara Syrian Catholic Church while embracing the call to evangelize and serve our neighbors with Christ's love." },
    
    // Vicar Message
    { key: 'vicar_name', value: 'Fr. Daniel Mannil OIC' },
    { key: 'vicar_title', value: 'Message of Parish Vicar' },
    { key: 'vicar_subtitle', value: 'Parish Vicar, St. Thomas MSCC Nalanchira' },
    { key: 'vicar_image', value: 'images/parish_vicar.jpg' },
    { key: 'vicar_message', value: "My dear parishioners and friends, it brings me great joy to welcome you to our parish family. St. Thomas Malankara Syrian Catholic Church, Nalanchira has been a pillar of faith in this community for over 90 years. As we continue this blessed journey together, I encourage each of you to actively participate in our liturgical celebrations, prayer groups, and community service initiatives. Through our shared faith and fellowship, we build not just a church, but a true family in Christ. May God's abundant blessings be upon each of you and your families." }
  ];

  const stmtSettings = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(s => stmtSettings.run(s.key, s.value));
  stmtSettings.finalize();

  // Seed Carousel
  const defaultCarousel = [
    { title: 'Feast Banner 1', description: 'Parish Celebration', image_path: 'images/PERUNNAL_KODIYETT.jpg', display_order: 1 },
    { title: 'Feast Banner 2', description: 'Mass Service', image_path: 'images/PERUNNAL_KODIYETT_1.jpg', display_order: 2 }
  ];
  const stmtCarousel = db.prepare('INSERT INTO carousel (title, description, image_path, display_order) VALUES (?, ?, ?, ?)');
  defaultCarousel.forEach(c => stmtCarousel.run(c.title, c.description, c.image_path, c.display_order));
  stmtCarousel.finalize();

  // Seed Schedules
  const defaultSchedules = [
    // Mon - Fri
    { day_name: 'Monday', service_name: 'Morning Prayer', service_time: '6:00 AM' },
    { day_name: 'Monday', service_name: 'Holy Qurbono', service_time: '6:10 AM' },
    { day_name: 'Monday', service_name: 'Evening Prayer', service_time: '6:30 PM' },
    { day_name: 'Tuesday', service_name: 'Morning Prayer', service_time: '6:00 AM' },
    { day_name: 'Tuesday', service_name: 'Holy Qurbono', service_time: '6:10 AM' },
    { day_name: 'Tuesday', service_name: 'Evening Prayer', service_time: '6:30 PM' },
    { day_name: 'Wednesday', service_name: 'Morning Prayer', service_time: '6:00 AM' },
    { day_name: 'Wednesday', service_name: 'Holy Qurbono', service_time: '6:10 AM' },
    { day_name: 'Wednesday', service_name: 'Evening Prayer', service_time: '6:30 PM' },
    { day_name: 'Thursday', service_name: 'Morning Prayer', service_time: '6:00 AM' },
    { day_name: 'Thursday', service_name: 'Holy Qurbono', service_time: '6:10 AM' },
    { day_name: 'Thursday', service_name: 'Evening Prayer', service_time: '6:30 PM' },
    { day_name: 'Friday', service_name: 'Morning Prayer', service_time: '6:00 AM' },
    { day_name: 'Friday', service_name: 'Holy Qurbono', service_time: '6:10 AM' },
    { day_name: 'Friday', service_name: 'Evening Prayer', service_time: '6:30 PM' },
    // Sat
    { day_name: 'Saturday', service_name: 'Morning Prayer', service_time: '6:30 AM' },
    { day_name: 'Saturday', service_name: 'Holy Qurbono', service_time: '6:45 AM' },
    { day_name: 'Saturday', service_name: 'Novena & Evening Prayer', service_time: '5:30 PM' },
    // Sun
    { day_name: 'Sunday', service_name: 'Morning Prayer', service_time: '6:30 AM' },
    { day_name: 'Sunday', service_name: 'Holy Qurbono (First Service)', service_time: '7:30 AM' },
    { day_name: 'Sunday', service_name: 'Holy Qurbono (Second Service)', service_time: '9:00 AM' },
    { day_name: 'Sunday', service_name: 'Evening Prayer', service_time: '5:30 PM' }
  ];
  const stmtSchedules = db.prepare('INSERT INTO schedules (day_name, service_name, service_time) VALUES (?, ?, ?)');
  defaultSchedules.forEach(s => stmtSchedules.run(s.day_name, s.service_name, s.service_time));
  stmtSchedules.finalize();

  // Seed Personnel (Clergy & Committee)
  const defaultPersonnel = [
    { name: 'Rev. Fr. Daniel Mannil OIC', role: 'Vicar', description: 'Serving as our parish vicar, Rev. Fr. Daniel Mannil OIC', phone: '+91-9876543210', email: 'fr.daniel@churchmail.com', image_path: 'images/parish_vicar.jpg', category: 'clergy', display_order: 1 },
    { name: 'Rev. Fr. Dany Mathew OIC', role: 'Associate Vicar', description: 'Fr. Dany Mathew OIC serves as our Associate Vicar', phone: '+91-9876543211', email: 'fr.thomas@churchmail.com', image_path: 'images/parish_associatevicar.png', category: 'clergy', display_order: 2 },
    { name: 'Rev. Sr. Kran SIC', role: 'Missionary', description: 'Assisting in liturgical services, parish ministries, and community welfare programs.', phone: '+91-9876543212', email: 'deacon@churchmail.com', image_path: 'images/missionary.jpg', category: 'clergy', display_order: 3 },
    
    // Parish Committee
    { name: 'Mr. George Thomas Puthiyathu', role: 'Trustee', description: 'Leading our parish council with dedication and wisdom, ensuring the smooth functioning of all parish activities and programs.', phone: '+91 98765 43210', email: '', image_path: 'images/trustee.jpg', category: 'committee', display_order: 4 },
    { name: 'Mr. Michael Daniel Kumpukkattu', role: 'Secretary', description: 'Supporting the president in managing parish affairs and coordinating various community programs and initiatives.', phone: '+91 98765 67890', email: '', image_path: 'images/person1.jpg', category: 'committee', display_order: 5 },
    { name: 'Mr. Sajin Sabu Anugraha', role: 'Joint Secretary', description: 'Managing parish records, communications, and ensuring proper documentation of all parish activities and decisions.', phone: '+91 98765 12345', email: '', image_path: 'images/person1.jpg', category: 'committee', display_order: 6 },
    { name: 'Mrs. Sarah Joseph', role: 'Treasurer', description: 'Responsible for managing parish finances, maintaining transparency, and ensuring proper financial stewardship.', phone: '+91 98765 00000', email: '', image_path: 'images/person1.jpg', category: 'committee', display_order: 7 },
    { name: 'Mr. George Mathew', role: 'Member', description: 'Active member of the parish council, contributing to decision-making and supporting various parish initiatives.', phone: '+91 98765 11111', email: '', image_path: 'images/person1.jpg', category: 'committee', display_order: 8 },
    { name: 'Mrs. Elizabeth Thomas', role: 'Member', description: 'Dedicated member working towards the spiritual and social development of our parish community.', phone: '+91 98765 22222', email: '', image_path: 'images/person1.jpg', category: 'committee', display_order: 9 }
  ];
  const stmtPersonnel = db.prepare('INSERT INTO personnel (name, role, description, phone, email, image_path, category, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  defaultPersonnel.forEach(p => stmtPersonnel.run(p.name, p.role, p.description, p.phone, p.email, p.image_path, p.category, p.display_order));
  stmtPersonnel.finalize();

  // Seed Organizations
  const defaultOrgs = [
    {
      slug: 'sunday',
      name: 'Sunday School',
      badge: 'Faith & Catechism',
      description: 'The Sunday School of STMSCC nurtures the faith of our children through catechism and moral instruction. It helps form a strong Christian foundation for the next generation.',
      features: JSON.stringify([
        'Faith formation and Catechism classes',
        'Preparation for First Holy Communion & Solemn Confession',
        'Annual Bible fest, talent competitions, and moral retreats'
      ]),
      image_path: 'images/CHURCH FRONT VIEW.jpg'
    },
    {
      slug: 'mcym',
      name: 'MCYM',
      badge: 'Youth Empowerment',
      description: 'The Malankara Catholic Youth Movement (MCYM) empowers our youth with faith-based leadership, community service, and spiritual growth.',
      features: JSON.stringify([
        'Leadership training and youth camps',
        'Charity projects, medical camps, and social welfare programs',
        'Active involvement in parish liturgies and spiritual events'
      ]),
      image_path: 'images/PERUNNAL_KODIYETT.jpg'
    },
    {
      slug: 'mcmf',
      name: 'MCMF',
      badge: "Men's Ministry",
      description: "The Malankara Catholic Men's Forum (MCMF) supports the spiritual and social development of the men in our parish through active fellowship and faith.",
      features: JSON.stringify([
        "Weekly Men's prayer fellowship and family retreats",
        'Actively assisting in parish administrative and development works',
        'Initiatives for helping needy families and parish members'
      ]),
      image_path: 'images/PERUNNAL_KODIYETT_1.jpg'
    },
    {
      slug: 'mca',
      name: 'MCA',
      badge: 'Laity & Unity',
      description: 'The Malankara Catholic Association (MCA) promotes unity among parishioners and plays a pivotal role in parish activities and church development.',
      features: JSON.stringify([
        'Unifying Malankara Catholic families across the parish',
        'Educational grants and charity programs for local students',
        'Coordinating central community festivals, feasts, and events'
      ]),
      image_path: 'images/catholicos.jpg'
    }
  ];
  const stmtOrgs = db.prepare('INSERT INTO organizations (slug, name, badge, description, features, image_path) VALUES (?, ?, ?, ?, ?, ?)');
  defaultOrgs.forEach(o => stmtOrgs.run(o.slug, o.name, o.badge, o.description, o.features, o.image_path));
  stmtOrgs.finalize();

  // Seed Org Members
  const defaultOrgMembers = [
    { org_slug: 'sunday', name: 'Sr. Mary Joseph', role: 'Headmistress', phone: '+91 98765 43210', image_path: 'images/person1.jpg' },
    { org_slug: 'sunday', name: 'Mr. Joseph Mathew', role: 'Senior Teacher', phone: '+91 98765 12345', image_path: 'images/person1.jpg' },
    { org_slug: 'mcym', name: 'John Varghese', role: 'President', phone: '+91 98765 67890', image_path: 'images/person1.jpg' },
    { org_slug: 'mcmf', name: 'Thomas Kurian', role: 'Secretary', phone: '+91 98765 54321', image_path: 'images/person1.jpg' },
    { org_slug: 'mca', name: 'Lucy Mathew', role: 'Treasurer', phone: '+91 98765 00000', image_path: 'images/person1.jpg' }
  ];
  const stmtOrgMembers = db.prepare('INSERT INTO organization_members (org_slug, name, role, phone, image_path) VALUES (?, ?, ?, ?, ?)');
  defaultOrgMembers.forEach(m => stmtOrgMembers.run(m.org_slug, m.name, m.role, m.phone, m.image_path));
  stmtOrgMembers.finalize();

  // Seed default Gallery items
  const defaultGallery = [
    { title: 'Parish Procession', category: 'feast', image_path: 'images/PERUNNAL_KODIYETT.jpg' },
    { title: 'Holy Mass', category: 'feast', image_path: 'images/PERUNNAL_KODIYETT_1.jpg' },
    { title: 'Parish Cathedral View', category: 'building', image_path: 'images/CHURCH FRONT VIEW.jpg' }
  ];
  const stmtGallery = db.prepare('INSERT INTO gallery (title, category, image_path) VALUES (?, ?, ?)');
  defaultGallery.forEach(g => stmtGallery.run(g.title, g.category, g.image_path));
  stmtGallery.finalize();

  // Seed default Events
  const defaultEvents = [
    { title: '90th Anniversary Celebration', description: 'Join us for our 90th anniversary celebration with a special Holy Qurbana, cultural events, and community lunch.', date_text: 'August 15, 2025', image_path: 'images/PERUNNAL_KODIYETT.jpg' },
    { title: 'Sunday School Registration', description: 'Sunday School admissions are now open. Please register at the parish office before July 31.', date_text: 'July 1–31, 2025', image_path: 'images/PERUNNAL_KODIYETT_1.jpg' },
    { title: 'Weekly Holy Qurbana', description: 'Join us every Sunday for the Holy Qurbana (Divine Liturgy) and spiritual fellowship.', date_text: 'Every Sunday', image_path: 'images/CHURCH FRONT VIEW.jpg' }
  ];
  const stmtEvents = db.prepare('INSERT INTO events (title, description, date_text, image_path) VALUES (?, ?, ?, ?)');
  defaultEvents.forEach(e => stmtEvents.run(e.title, e.description, e.date_text, e.image_path));
  stmtEvents.finalize();

  // Seed default Prayer Groups
  const defaultGroups = [
    { name: "St. Mary's Prayer Group", leader: 'Anju Thomas', coordinator: 'Jinu Mathew', phone: '+91 98765 43210', image_path: 'images/person1.jpg', display_order: 1 },
    { name: "St. Joseph's Prayer Group", leader: 'Roselin Kurian', coordinator: 'Binu John', phone: '+91 98765 12345', image_path: 'images/parish_vicar.jpg', display_order: 2 },
    { name: "St. Paul's Prayer Group", leader: 'Reena George', coordinator: 'Paul Varghese', phone: '+91 98765 67890', image_path: 'images/catholicos.jpg', display_order: 3 }
  ];
  const stmtGroups = db.prepare('INSERT INTO prayer_groups (name, leader, coordinator, phone, image_path, display_order) VALUES (?, ?, ?, ?, ?, ?)');
  defaultGroups.forEach(g => stmtGroups.run(g.name, g.leader, g.coordinator, g.phone, g.image_path, g.display_order));
  stmtGroups.finalize();
  
  console.log('Seeding completed successfully.');
}

module.exports = {
  db,
  initDatabase
};
