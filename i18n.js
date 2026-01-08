(() => {
  const LANG_KEY = "fokusflow_lang_v1";
  const locales = {
    id: "id-ID",
    en: "en-US",
  };
  const translations = {
    id: {
      title: {
        main: "FokusFlow - Timer Fokus",
        weekly: "FokusFlow - Tugas Mingguan",
      },
      nav: {
        focus: "Fokus",
        short: "Istirahat",
        long: "Istirahat Panjang",
      },
      controls: {
        reset: "Reset",
        resetDay: "Reset hari",
        start: "Mulai",
        pause: "Jeda",
        next: "Lewati",
      },
      labels: {
        sessionActive: "Sesi aktif",
        next: "Berikutnya: {mode}",
        noTask: "Tanpa tugas",
        activeTask: "Sedang aktif: {task}",
        focusDone: "{count} fokus selesai",
        preview: "Pratinjau: {mode} {time}",
      },
      task: {
        list: "Daftar tugas",
        today: "Fokus hari ini",
        estimate: "Estimasi selesai: {label}",
        weekly: "Tugas mingguan",
        clearCompleted: "Hapus tugas selesai",
        delete: "Hapus tugas",
        add: "Tambah tugas +",
        save: "Simpan",
        cancel: "Batal",
        completed: "Selesai",
        completedEmpty: "Belum ada tugas selesai.",
        summary:
          "Total: {total} tugas - Sisa fokus: {remaining} - Selesai: {done}",
        progress: "{done}/{total} fokus - Istirahat: {break}",
        focusCount: "{count} fokus",
        doneAt: "Selesai: {date} {time} WIB",
        doneEmpty: "Selesai: -",
        namePlaceholder: "Nama tugas",
      },
      settings: {
        title: "Pengaturan",
        subtitle: "Atur ritme",
        autoSwitch: "Otomatis ganti sesi",
        focusMinutes: "Fokus (menit)",
        shortMinutes: "Istirahat pendek (menit)",
        longMinutes: "Istirahat panjang (menit)",
        note: "Setiap 4 sesi fokus, timer akan masuk ke istirahat panjang.",
      },
      footer:
        "FokusFlow menyimpan data di browser Anda. Tanpa akun, tanpa pelacakan.",
      break: {
        auto: "Ikuti siklus",
        autoShort: "Auto",
        short: "Pendek",
        long: "Panjang",
        label: "Istirahat: {label}",
      },
      mode: {
        focus: "Fokus",
        short: "Istirahat",
        long: "Istirahat Panjang",
      },
      weekly: {
        title: "Rencana 1 minggu",
        header: "Tugas mingguan",
        thisWeek: "Minggu ini",
        todayLink: "Hari ini",
        copy: "Salin",
        paste: "Tempel",
      },
      sound: {
        on: "Suara: On",
        off: "Suara: Off",
      },
      time: {
        hourShort: "j",
        minuteShort: "m",
      },
    },
    en: {
      title: {
        main: "FokusFlow - Focus Timer",
        weekly: "FokusFlow - Weekly Tasks",
      },
      nav: {
        focus: "Focus",
        short: "Break",
        long: "Long Break",
      },
      controls: {
        reset: "Reset",
        resetDay: "Reset day",
        start: "Start",
        pause: "Pause",
        next: "Skip",
      },
      labels: {
        sessionActive: "Active session",
        next: "Next: {mode}",
        noTask: "No task",
        activeTask: "Active: {task}",
        focusDone: "{count} focus done",
        preview: "Preview: {mode} {time}",
      },
      task: {
        list: "Task list",
        today: "Today's focus",
        estimate: "Finish by: {label}",
        weekly: "Weekly tasks",
        clearCompleted: "Clear completed tasks",
        delete: "Delete task",
        add: "Add task +",
        save: "Save",
        cancel: "Cancel",
        completed: "Completed",
        completedEmpty: "No completed tasks yet.",
        summary:
          "Total: {total} tasks - Remaining focus: {remaining} - Completed: {done}",
        progress: "{done}/{total} focus - Break: {break}",
        focusCount: "{count} focus",
        doneAt: "Done: {date} {time} WIB",
        doneEmpty: "Done: -",
        namePlaceholder: "Task name",
      },
      settings: {
        title: "Settings",
        subtitle: "Set your rhythm",
        autoSwitch: "Auto switch session",
        focusMinutes: "Focus (minutes)",
        shortMinutes: "Short break (minutes)",
        longMinutes: "Long break (minutes)",
        note: "After 4 focus sessions, the timer switches to a long break.",
      },
      footer: "FokusFlow stores data in your browser. No account, no tracking.",
      break: {
        auto: "Cycle",
        autoShort: "Auto",
        short: "Short",
        long: "Long",
        label: "Break: {label}",
      },
      mode: {
        focus: "Focus",
        short: "Break",
        long: "Long Break",
      },
      weekly: {
        title: "1-week plan",
        header: "Weekly tasks",
        thisWeek: "This week",
        todayLink: "Today",
        copy: "Copy",
        paste: "Paste",
      },
      sound: {
        on: "Sound: On",
        off: "Sound: Off",
      },
      time: {
        hourShort: "h",
        minuteShort: "m",
      },
    },
  };

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && translations[saved]) return saved;
    return "en";
  }

  document.documentElement.lang = getLang();

  function setLang(lang) {
    const next = translations[lang] ? lang : "id";
    localStorage.setItem(LANG_KEY, next);
    document.documentElement.lang = next;
  }

  function getNested(obj, key) {
    return key.split(".").reduce((acc, part) => acc?.[part], obj);
  }

  function t(key, vars = {}) {
    const lang = getLang();
    const raw =
      getNested(translations[lang], key) ||
      getNested(translations.id, key) ||
      key;
    return String(raw).replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? vars[k] : `{${k}}`
    );
  }

  function locale() {
    const lang = getLang();
    return locales[lang] || "id-ID";
  }

  function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
  }

  window.FokusI18n = {
    t,
    setLang,
    getLang,
    applyTranslations,
    locale,
  };
})();
