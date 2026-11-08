/* SchoolEx LIVE DEMO seed — runs BEFORE the app bundle.
   Fills the browser's localStorage with a small sample school so
   visitors can click through the real system. Data lives only in
   the visitor's own browser; the real SchoolEx app always starts
   empty. Re-seeds only when the version flag below changes. */
(function () {
  var FLAG = 'schoolex_demo_seeded_v2';
  try { if (localStorage.getItem(FLAG)) return; } catch (e) { return; }

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function mk(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function label(key) { var p = key.split('-'); return MONTHS[Number(p[1]) - 1] + ' ' + p[0]; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function niceDate(isoStr) { var p = isoStr.split('-'); return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0]; }

  var now = new Date();
  var m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  var m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var m2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  var K2 = mk(m2), K1 = mk(m1), K0 = mk(m0);
  var admit = iso(m2); // everyone "admitted" at the start of the term

  /* ---------------- classes ---------------- */
  var classes = [
    { id: 'CLS-001', name: 'Class 1', sectionsCount: 1, sections: ['A'], fee: 3000, createdAt: admit, latestSession: '2026 - 2027' },
    { id: 'CLS-002', name: 'Class 2', sectionsCount: 1, sections: ['A'], fee: 3000, createdAt: admit, latestSession: '2026 - 2027' },
    { id: 'CLS-003', name: 'Class 3', sectionsCount: 1, sections: ['A'], fee: 3500, createdAt: admit, latestSession: '2026 - 2027' },
    { id: 'CLS-004', name: 'Class 4', sectionsCount: 1, sections: ['A'], fee: 4000, createdAt: admit, latestSession: '2026 - 2027' }
  ];
  var feeOf = { 'Class 1': 3000, 'Class 2': 3000, 'Class 3': 3500, 'Class 4': 4000 };

  /* ---------------- students (24) ---------------- */
  // [name, gender, father, familyId, dob]
  var roster = {
    'Class 1': [
      ['Ahmed Raza', 'Male', 'Imran Raza', 'F-001', '2018-03-14'],
      ['Fatima Zahra', 'Female', 'Muhammad Zahid', 'F-002', '2018-06-22'],
      ['Ali Hamza', 'Male', 'Hamza Tariq', 'F-003', '2018-01-30'],
      ['Areeba Khan', 'Female', 'Asif Khan', 'F-004', '2018-09-05'],
      ['Hassan Ali', 'Male', 'Sajid Ali', 'F-005', '2018-04-18'],
      ['Mahnoor Fatima', 'Female', 'Naveed Ahmad', 'F-006', '2018-11-11']
    ],
    'Class 2': [
      ['Usman Ghani', 'Male', 'Abdul Ghani', 'F-007', '2017-02-09'],
      ['Zainab Bibi', 'Female', 'Liaqat Ali', 'F-008', '2017-07-25'],
      ['Bilal Ahmad', 'Male', 'Shabbir Ahmad', 'F-009', '2017-05-16'],
      ['Hira Shahid', 'Female', 'Shahid Mehmood', 'F-010', '2017-10-02'],
      ['Omar Farooq', 'Male', 'Farooq Azam', 'F-011', '2017-08-19'],
      ['Iqra Noor', 'Female', 'Noor Muhammad', 'F-012', '2017-12-07']
    ],
    'Class 3': [
      ['Hamza Sheikh', 'Male', 'Rashid Sheikh', 'F-013', '2016-03-27'],
      ['Ayesha Siddiqua', 'Female', 'Abu Bakar Siddique', 'F-014', '2016-06-13'],
      ['Talha Zubair', 'Male', 'Zubair Ahmad', 'F-015', '2016-09-21'],
      ['Maryam Tariq', 'Female', 'Tariq Aziz', 'F-016', '2016-01-24'],
      ['Saad Rehman', 'Male', 'Abdul Rehman', 'F-017', '2016-11-30'],
      ['Zara Mehmood', 'Female', 'Mehmood Alam', 'F-023', '2016-05-08']
    ],
    'Class 4': [
      ['Abdullah Khan', 'Male', 'Sher Khan', 'F-019', '2015-04-11'],
      ['Khadija Noor', 'Female', 'Muhammad Ramzan', 'F-020', '2015-08-26'],
      ['Ibrahim Afridi', 'Male', 'Javed Afridi', 'F-021', '2015-02-17'],
      ['Hafsa Umar', 'Female', 'Umar Hayat', 'F-022', '2015-10-09'],
      ['Yasir Mehmood', 'Male', 'Mehmood Alam', 'F-023', '2015-06-20'],
      ['Dua Fatima', 'Female', 'Khalid Mehmood', 'F-024', '2015-12-03']
    ]
  };
  var students = [], seq = 100;
  Object.keys(roster).forEach(function (cls) {
    roster[cls].forEach(function (r, i) {
      seq += 1;
      students.push({
        id: 'S-00' + seq, name: r[0], family: r[2], familyId: r[3], fatherName: r[2],
        rollNo: String(i + 1), class: cls, classId: classes.find(function (c) { return c.name === cls; }).id,
        section: 'A', status: 'Active', gender: r[1], dob: r[4],
        phone: '0300-5550' + String(100 + seq).slice(1), admissionDate: admit, isNewAdmission: false
      });
    });
  });

  /* ---------------- staff (8) ---------------- */
  function staff(id, name, role, cat, dept, qual, salary, pay, gender, paidMonths) {
    return {
      id: id, name: name, role: role, category: cat, department: dept, qualification: qual,
      salary: salary, payStatus: pay, paymentMethod: 'Bank Transfer', status: 'Active',
      phone: '0300-5551' + id.slice(-3), email: name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ').join('.') + '@demomodel.edu.pk',
      joiningDate: '2024-08-01', gender: gender, paidMonths: paidMonths || []
    };
  }
  var staffList = [
    staff('STF-0001', 'Ayesha Khan', 'Principal', 'Admin', 'Administration', 'M.Ed.', 85000, 'Paid', 'Female', [label(K2), label(K1)]),
    staff('STF-0002', 'Muhammad Ilyas', 'Teacher', 'Teacher', 'Academics', 'M.Sc. Mathematics', 55000, 'Paid', 'Male', [label(K2), label(K1)]),
    staff('STF-0003', 'Fatima Noor', 'Teacher', 'Teacher', 'Academics', 'M.A. English', 52000, 'Paid', 'Female', [label(K2), label(K1)]),
    staff('STF-0004', 'Bilal Ahmed', 'Teacher', 'Teacher', 'Academics', 'B.Sc. (Hons)', 50000, 'Pending', 'Male', [label(K2)]),
    staff('STF-0005', 'Sana Tariq', 'Teacher', 'Teacher', 'Academics', 'M.A. Urdu', 50000, 'Paid', 'Female', [label(K2), label(K1)]),
    staff('STF-0006', 'Hassan Raza', 'Teacher', 'Teacher', 'Academics', 'M.Sc. Physics', 48000, 'Pending', 'Male', [label(K2)]),
    staff('STF-0007', 'Shahid Afridi', 'Accountant', 'Finance', 'Finance', 'M.Com', 60000, 'Paid', 'Male', [label(K2), label(K1)]),
    staff('STF-0008', 'Rabia Aslam', 'Office Manager', 'Admin', 'Administration', 'BBA', 45000, 'Paid', 'Female', [label(K2), label(K1)])
  ];

  /* ---------------- fee ledger + payments ---------------- */
  var ledger = {}, payments = [], rcp = 2000, payN = 0;
  var byFamily = {};
  students.forEach(function (s) { (byFamily[s.familyId] = byFamily[s.familyId] || []).push(s); });

  function item(s, key, paid) {
    var fee = feeOf[s.class];
    return {
      id: 'LEDGER-' + s.id + '-' + key, studentId: s.id, month: label(key), monthKey: key,
      type: 'Monthly Fee', reason: 'Monthly Tuition Fee', discount: 0, additionalDiscount: 0,
      classFeeRate: fee, total: fee, paidAmount: paid,
      status: paid >= fee ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
      generatedAt: new Date().toISOString()
    };
  }
  // term months: first two fully paid, current month mixed
  students.forEach(function (s, i) {
    var cur = [feeOf[s.class], 0, Math.floor(feeOf[s.class] / 2), 0][i % 4];
    ledger[s.id] = [item(s, K2, feeOf[s.class]), item(s, K1, feeOf[s.class]), item(s, K0, cur)];
  });
  function familyPayment(fam, key, day, parts) {
    var kids = byFamily[fam];
    var allocations = [], total = 0;
    parts.forEach(function (p) { allocations.push({ studentId: p.s.id, itemId: 'LEDGER-' + p.s.id + '-' + key, amount: p.amt }); total += p.amt; });
    if (!total) return;
    rcp += 1; payN += 1;
    payments.push({
      id: 'PAY-DEMO-' + payN, receiptNo: 'RCP-' + rcp,
      date: key + '-' + day, createdAt: key + '-' + day + 'T09:30:00.000Z',
      familyId: fam, studentIds: kids.map(function (k) { return k.id; }),
      amount: total, method: payN % 2 ? 'Cash' : 'Bank Transfer',
      allocations: allocations, creditUsed: 0, creditAdded: 0, createdBy: 'Demo School'
    });
  }
  Object.keys(byFamily).forEach(function (fam) {
    var kids = byFamily[fam];
    familyPayment(fam, K2, '06', kids.map(function (s) { return { s: s, amt: feeOf[s.class] }; }));
    familyPayment(fam, K1, '06', kids.map(function (s) { return { s: s, amt: feeOf[s.class] }; }));
    var parts = kids.map(function (s) {
      var it = ledger[s.id].find(function (x) { return x.monthKey === K0; });
      return { s: s, amt: it.paidAmount };
    }).filter(function (p) { return p.amt > 0; });
    familyPayment(fam, K0, '04', parts);
  });

  /* ---------------- school finance ledger ---------------- */
  function tx(id, dateIso, type, category, reason, amount, method) {
    return {
      id: id, date: niceDate(dateIso), rawDate: dateIso, time: '10:30 AM',
      timestamp: new Date(dateIso + 'T10:30:00').getTime(), amount: amount,
      createdBy: 'Demo School', paymentType: method, type: type, category: category, reason: reason
    };
  }
  var salaryTotal = staffList.reduce(function (a, s) { return a + s.salary; }, 0);
  var txs = [
    tx('LTX-DEMO-1', K1 + '-28', 'Outgoing', 'Staff Salary', 'Staff salaries — ' + label(K1), salaryTotal, 'Bank Transfer'),
    tx('LTX-DEMO-2', K1 + '-12', 'Outgoing', 'Electricity Bill', 'Electricity bill — main campus', 18500, 'Cash'),
    tx('LTX-DEMO-3', K0 + '-03', 'Incoming', 'Fund', 'Annual fund contribution — local community', 25000, 'Cash'),
    tx('LTX-DEMO-4', K0 + '-09', 'Outgoing', 'Stationery', 'Stationery & printing — exam papers', 6400, 'Cash'),
    tx('LTX-DEMO-5', K0 + '-15', 'Outgoing', 'Maintenance', 'Building maintenance — classroom repairs', 12000, 'Bank Transfer')
  ];

  /* ---------------- attendance (last 5 school days) ---------------- */
  var attendance = {}, days = [], cursor = new Date(now);
  while (days.length < 5) {
    if (cursor.getDay() !== 0) days.unshift(iso(cursor)); // skip Sundays
    cursor.setDate(cursor.getDate() - 1);
  }
  days.forEach(function (d, di) {
    var recs = [];
    students.forEach(function (s, si) {
      var st = 'present';
      if ((si + di) % 11 === 5) st = 'absent'; else if ((si + di) % 7 === 3) st = 'late'; else if ((si * 3 + di) % 13 === 6) st = 'leave';
      recs.push({ id: s.id, name: s.name, type: 'student', date: d, status: st, checkInTime: '07:55', class: s.class, section: 'A', isManual: true });
    });
    staffList.forEach(function (t, ti) {
      var st = (ti + di) % 9 === 4 ? 'late' : 'present';
      recs.push({ id: t.id, name: t.name, type: 'staff', date: d, status: st, checkInTime: '07:45', department: t.department, role: t.role, isManual: true });
    });
    attendance[d] = recs;
  });

  /* ---------------- announcements ---------------- */
  var announcements = [
    { id: 'ANN-DEMO-1', title: 'Monthly tests begin next week', audience: 'All', priority: 'High', date: niceDate(days[4]), rawDate: days[4], content: 'Monthly tests for Classes 1–4 begin next week. Date sheets have been shared with class teachers — please prepare accordingly.', author: 'Ayesha Khan (Principal)', channels: ['WhatsApp'] },
    { id: 'ANN-DEMO-2', title: 'Winter uniform reminder', audience: 'Parents', priority: 'Normal', date: niceDate(days[2]), rawDate: days[2], content: 'Please send children in the winter uniform (navy sweater/blazer) from Monday as the weather has turned cold.', author: 'Rabia Aslam (Office)', channels: ['WhatsApp', 'SMS'] }
  ];

  /* ---------------- settings ---------------- */
  var settings = {
    schoolName: 'Demo Model School', schoolTagline: 'Excellence in Education & Character Building',
    schoolLogo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%230e9f6e"/><path d="M32 14 6 26l26 12 22-10.2V42h4V26L32 14zm-14 16.6V44c0 3.3 6.3 6 14 6s14-2.7 14-6V30.6l-14 6.5-14-6.5z" fill="white"/></svg>',
    campusName: 'Main Campus — Peshawar', schoolPhone: '091-555 0100', schoolEmail: 'info@demomodel.edu.pk',
    schoolWebsite: '', schoolAddress: 'University Road, Peshawar (Demo)', session: '2026 - 2027',
    principalName: 'Ayesha Khan', registrationNumber: 'DEMO-2026-001',
    bankName: '', accountNumber: '', accountTitle: '', branchName: '', branchCode: '', iban: '',
    challanDueDay: 10, lateFineAmount: 500,
    rollNumberSlipTemplate: 'minimal-stream', studentIdCardTemplate: 'modern-tech', staffIdCardTemplate: 'modern-tech',
    feeChallanTemplate: 'standard-3copy', studentFeeCardTemplate: 'register-card', staffSalarySlipTemplate: 'executive-emerald',
    examDmcTemplate: 'official-crest', attendanceRegisterTemplate: 'official-weekly'
  };

  /* ---------------- write everything ---------------- */
  var put = function (k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} };
  put('schoollee_school_settings_v2', settings);
  put('schoollee_offline_students_clean_v1', students);
  put('schoollee_offline_staff_clean_v1', staffList);
  put('schoollee_classes_clean_v1', classes);
  put('schoollee_billing_start_month', K2);
  put('schoollee_student_fee_ledger_clean_v1', ledger);
  put('schoollee_fee_payments_v1', payments);
  put('schoollee_ledger_transactions_clean_v1', txs);
  put('schooliee_attendance_records_clean_v1', attendance);
  put('schooliee_last_attendance_date_clean_v1', days[days.length - 1]);
  put('schooliee_announcements_clean_v1', announcements);
  put('schoollee_att_seed_purged_v1', '1');
  put(FLAG, '1');

  /* ---------------- demo banner ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.createElement('div');
    bar.setAttribute('style', 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;background:rgba(10,18,28,.92);color:#e8f5ee;font:500 13px/1.45 system-ui,sans-serif;padding:9px 14px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;max-width:94vw;flex-wrap:wrap;justify-content:center');
    bar.innerHTML = '<span>🎓 <strong>SchoolEx LIVE DEMO</strong> — sample school data, saved only in your browser. Feel free to click around and try everything.</span>';
    var reset = document.createElement('button');
    reset.textContent = 'Reset demo';
    reset.setAttribute('style', 'background:#0e9f6e;color:#fff;border:0;border-radius:999px;padding:5px 12px;cursor:pointer;font:600 12px system-ui');
    reset.onclick = function () {
      try {
        Object.keys(localStorage).filter(function (k) { return /^(schoollee_|schooliee_|schoolex_)/.test(k); }).forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
      location.reload();
    };
    bar.appendChild(reset);
    document.body.appendChild(bar);
  });
})();
