import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { FiTrash2, FiRefreshCw, FiGrid, FiCalendar, FiCheckCircle, FiCircle, FiEye, FiEyeOff, FiAlertTriangle, FiGithub, FiHelpCircle, FiX } from 'react-icons/fi';
import './App.css';

type Category = {
  id: string;
  name: string;
  inputRate: number;
  dailyRate: number;
  hidden?: boolean;
};

type Theme = 'default' | 'fun';

type DayEntry = {
  id: string;
  categoryId: string;
  hours: number;
};

type DayEntriesByDay = Record<number, DayEntry[]>;

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORIES_STORAGE_KEY = 'invoice-calendar.categories';
const ENTRIES_STORAGE_PREFIX = 'invoice-calendar.entries.';
const VIEW_KEY = 'invoice-calendar.view';
const THEME_STORAGE_KEY = 'invoice-calendar.theme';

function createId(): string {
  const generator = (globalThis.crypto as Crypto | undefined)?.randomUUID;
  return generator ? generator.call(globalThis.crypto) : `id-${Math.random().toString(36).slice(2, 9)}`;
}

function loadCategoriesFromStorage(): Category[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const stored = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const raw = item as Record<string, unknown>;
        const id = typeof raw.id === 'string' ? raw.id : '';
        const name = typeof raw.name === 'string' ? raw.name : '';
        const rawDaily = raw.dailyRate;
        const rawInput = raw.inputRate;
        const dailyRate = Number(rawDaily ?? rawInput ?? 0);
        const inputRate = Number(rawInput ?? rawDaily ?? 0);

        if (!id || !name || !Number.isFinite(dailyRate) || dailyRate <= 0) {
          return null;
        }

        const normalized: Category = {
          id,
          name,
          inputRate: Number.isFinite(inputRate) && inputRate > 0 ? inputRate : dailyRate,
          dailyRate,
          hidden: Boolean(raw.hidden === true),
        };

        return normalized;
      })
      .filter((value): value is Category => value !== null);
  } catch (error) {
    console.error('Failed to parse categories from storage', error);
    return [];
  }
}

function loadThemeFromStorage(): Theme {
  if (typeof window === 'undefined') {
    return 'default';
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  const next = saved === 'fun' ? 'fun' : 'default';

  if (saved === 'fun') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'fun');
    } catch (error) {
      console.error('Failed to migrate theme in storage', error);
    }
  }

  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    const body = document.body;
    if (html) {
      html.dataset.theme = next;
    }
    if (body) {
      body.dataset.theme = next;
    }
  }

  return next;
}

function App() {
  const today = useMemo(() => new Date(), []);

  function loadView() {
    if (typeof window === 'undefined') return { month: today.getMonth(), year: today.getFullYear() };
    try {
      const raw = window.localStorage.getItem(VIEW_KEY);
      if (!raw) return { month: today.getMonth(), year: today.getFullYear() };
      const parsed = JSON.parse(raw) as { month?: number; year?: number };
      const m = Number.isFinite(parsed.month as number) ? (parsed.month as number) : today.getMonth();
      const y = Number.isFinite(parsed.year as number) ? (parsed.year as number) : today.getFullYear();
      return { month: m, year: y };
    } catch (e) {
      return { month: today.getMonth(), year: today.getFullYear() };
    }
  }

  const initialView = loadView();
  const [month, setMonth] = useState<number>(initialView.month);
  const [year, setYear] = useState<number>(initialView.year);
  const [categories, setCategories] = useState<Category[]>(() => loadCategoriesFromStorage());
  const [categoryForm, setCategoryForm] = useState({ name: '', rate: '' });
  const [dayEntries, setDayEntries] = useState<DayEntriesByDay>(() => loadEntriesFromStorage(initialView.year, initialView.month));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [globalHoursInput, setGlobalHoursInput] = useState<string>('1');
  const [theme, setTheme] = useState<Theme>(() => loadThemeFromStorage());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Category[];
      if (Array.isArray(parsed)) {
        setCategories(parsed);
      }
    } catch (error) {
      console.error('Failed to parse categories from storage', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, JSON.stringify({ month, year }));
    } catch (e) {
      console.error('Failed to save view to storage', e);
    }
  }, [month, year]);

  useEffect(() => {
    if (selectedCategoryId && !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId('');
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Failed to save theme to storage', error);
    }

    const html = document.documentElement;
    const body = document.body;

    if (html) {
      html.dataset.theme = theme;
    }

    if (body) {
      body.dataset.theme = theme;
    }
  }, [theme]);

  function entriesKeyFor(y: number, m: number) {
    return `${ENTRIES_STORAGE_PREFIX}${y}-${m}`;
  }

  function loadEntriesFromStorage(y: number, m: number): DayEntriesByDay {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(entriesKeyFor(y, m));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: DayEntriesByDay = {};
      Object.entries(parsed).forEach(([dayKey, arr]) => {
        const dayNum = Number(dayKey);
        if (!Number.isFinite(dayNum)) return;
        if (!Array.isArray(arr)) return;
        const entries: DayEntry[] = arr
          .map((it) => {
            if (!it || typeof it !== 'object') return null;
            const r = it as Record<string, unknown>;
            const id = typeof r.id === 'string' ? r.id : null;
            const categoryId = typeof r.categoryId === 'string' ? r.categoryId : null;
            const hours = typeof r.hours === 'number' ? r.hours : Number(r.hours ?? 0);
            if (!id || !categoryId || !Number.isFinite(hours)) return null;
            return { id, categoryId, hours } as DayEntry;
          })
          .filter((v): v is DayEntry => v !== null);
        if (entries.length) out[dayNum] = entries;
      });
      return out;
    } catch (e) {
      console.error('Failed to load entries from storage', e);
      return {};
    }
  }

  function saveEntriesToStorage(y: number, m: number, entries: DayEntriesByDay) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(entriesKeyFor(y, m), JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save entries to storage', e);
    }
  }

  useEffect(() => {
    const loaded = loadEntriesFromStorage(year, month);
    setDayEntries(loaded);
  }, [month, year]);

  const formatHoursInputValue = (value: number) => {
    if (!Number.isFinite(value)) {
      return '0';
    }
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(rounded) < 1e-9) {
      return '0';
    }
    const formatted = rounded.toFixed(2);
    return formatted.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
    [],
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }), []);

  const formatMoney = (v: number) => currencyFormatter.format(Math.round(v * 100) / 100);
  const formatNum = (v: number) => numberFormatter.format(Math.round(v * 100) / 100);
  const formatHoursValue = (v: number) => `${formatNum(v)} hrs`;

  function handleResetWeek(week: Array<number | null>) {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Reset this week? This will clear all entries for the week.');
      if (!ok) return;
    }
    // remove entries for the days present in this week
    setDayEntries((prev) => {
      const next: DayEntriesByDay = { ...prev };
      let changed = false;
      week.forEach((d) => {
        if (d !== null && next[d]) {
          delete next[d];
          changed = true;
        }
      });
      if (changed) {
        saveEntriesToStorage(year, month, next);
        return next;
      }
      return prev;
    });
  }

  const parsedGlobalHours = useMemo(() => {
    const parsed = Number(globalHoursInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [globalHoursInput]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const visibleCategories = useMemo(() => categories.filter((c) => !c.hidden), [categories]);

  const hasUsableSelection = Boolean(selectedCategory && Math.abs(parsedGlobalHours) > 0);
  const hoursDisplay = formatHoursInputValue(parsedGlobalHours);
  const hoursPlural = Math.abs(Math.abs(parsedGlobalHours) - 1) < 1e-9 ? '' : 's';

  const hoursInputClass = parsedGlobalHours > 0 ? 'hours-positive' : parsedGlobalHours < 0 ? 'hours-negative' : '';

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstWeekday = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  const calendarCells = useMemo(() => {
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : null;
    });
  }, [daysInMonth, firstWeekday]);

  const weeklyHours = useMemo(() => {
    const weeks: number[] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      let sum = 0;
      for (let j = 0; j < 7; j++) {
        const day = calendarCells[i + j];
        if (day && dayEntries[day]) {
          sum += dayEntries[day].reduce((s, e) => {
            const cat = categories.find((c) => c.id === e.categoryId);
            if (!cat || cat.hidden) return s;
            return s + e.hours;
          }, 0);
        }
      }
      weeks.push(Math.round(sum * 100) / 100);
    }
    return weeks;
  }, [calendarCells, dayEntries]);

  function calculateDayTotal(entries: DayEntry[] = []): number {
    return entries.reduce((total, entry) => {
      const category = categories.find((cat) => cat.id === entry.categoryId);
      if (!category || category.hidden) return total;
      return total + entry.hours * category.dailyRate;
    }, 0);
  }

  const weeklyDollars = useMemo(() => {
    const weeksAmount: number[] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      let sum = 0;
      for (let j = 0; j < 7; j++) {
        const day = calendarCells[i + j];
        if (day && dayEntries[day]) {
          sum += dayEntries[day].reduce((s, e) => s + calculateDayTotal([e]), 0);
        }
      }
      weeksAmount.push(Math.round(sum * 100) / 100);
    }
    return weeksAmount;
  }, [calendarCells, dayEntries, categories]);

  const weeks = useMemo(() => {
    const out: (number | null)[][] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      out.push(calendarCells.slice(i, i + 7));
    }
    return out;
  }, [calendarCells]);

  const categorySummaries = useMemo(() => {
    return categories.map((category) => {
      const daySet = new Set<number>();
      let hoursTotal = 0;
      let amountTotal = 0;

      Object.entries(dayEntries).forEach(([dayKey, entries]) => {
        entries.forEach((entry) => {
          if (entry.categoryId === category.id) {
            daySet.add(Number(dayKey));
            hoursTotal += entry.hours;
            amountTotal += entry.hours * category.dailyRate;
          }
        });
      });

      return {
        category,
        dayCount: daySet.size,
        hoursTotal,
        amountTotal,
      };
    });
  }, [categories, dayEntries]);

  const grandTotal = useMemo(
    () => categorySummaries.filter(s => !s.category.hidden).reduce((sum, summary) => sum + summary.amountTotal, 0),
    [categorySummaries],
  );

  const grandHours = useMemo(
    () => categorySummaries.filter(s => !s.category.hidden).reduce((sum, summary) => sum + summary.hoursTotal, 0),
    [categorySummaries],
  );

  const handleAddCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = categoryForm.name.trim();
    const parsedRate = Number(categoryForm.rate);

    if (!trimmedName || !Number.isFinite(parsedRate) || parsedRate <= 0) {
      return;
    }

    const newCategory: Category = {
      id: createId(),
      name: trimmedName,
      inputRate: parsedRate,
      dailyRate: parsedRate,
    };

    setCategories((prev) => [...prev, newCategory]);
    setCategoryForm({ name: '', rate: '' });
    setSelectedCategoryId(newCategory.id);
  };

  const handleCategoryFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = categoryForm.name.trim();
    const parsedRate = Number(categoryForm.rate);

    if (!trimmedName || !Number.isFinite(parsedRate) || parsedRate <= 0) {
      return;
    }

    // If a category is selected and exists, update it
    if (selectedCategoryId) {
      const found = categories.some((c) => c.id === selectedCategoryId);
      if (found) {
        setCategories((prev) =>
          prev.map((c) => (c.id === selectedCategoryId ? { ...c, name: trimmedName, inputRate: parsedRate, dailyRate: parsedRate } : c)),
        );
        setCategoryForm({ name: trimmedName, rate: String(parsedRate) });
        return;
      }
    }

    // otherwise add new
    const newCategory: Category = {
      id: createId(),
      name: trimmedName,
      inputRate: parsedRate,
      dailyRate: parsedRate,
    };

    setCategories((prev) => [...prev, newCategory]);
    setCategoryForm({ name: '', rate: '' });
    setSelectedCategoryId(newCategory.id);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setCategoryForm({ name: cat.name, rate: String(cat.inputRate ?? cat.dailyRate ?? '') });
    }
  };

  const handleCancelEdit = () => {
    setSelectedCategoryId('');
    setCategoryForm({ name: '', rate: '' });
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Delete this category? This will also remove its entries from the calendar.');
      if (!ok) return;
    }
    const nextCategories = categories.filter((category) => category.id !== categoryId);

    setCategories(nextCategories);
    setSelectedCategoryId((prevSelected) =>
      prevSelected === categoryId ? nextCategories[0]?.id ?? '' : prevSelected,
    );
    setDayEntries((prev) => {
      const next: DayEntriesByDay = {};
      Object.entries(prev).forEach(([dayKey, entries]) => {
        const filtered = entries.filter((entry) => entry.categoryId !== categoryId);
        if (filtered.length > 0) {
          next[Number(dayKey)] = filtered;
        }
      });
      return next;
    });
  };

  const toggleCategoryVisibility = (categoryId: string) => {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, hidden: !c.hidden } : c)));
  };

  const handleDayCellClick = (dayNumber: number) => {
    if (!selectedCategory || Math.abs(parsedGlobalHours) < 1e-9) {
      if (!selectedCategory) {
        triggerSelectCategoryPopover('Select a category to add hours');
      }
      return;
    }

    const increment = Math.round(parsedGlobalHours * 100) / 100;
    if (Math.abs(increment) < 1e-9) {
      return;
    }

    setDayEntries((prev) => {
      const existingEntries = prev[dayNumber] ?? [];
      const existingIndex = existingEntries.findIndex((entry) => entry.categoryId === selectedCategory.id);

      if (existingIndex >= 0) {
        const updatedEntries = existingEntries
          .map((entry, index) => {
            if (index !== existingIndex) {
              return entry;
            }
            const nextHours = Math.round((entry.hours + increment) * 100) / 100;
            return { ...entry, hours: nextHours };
          })
          .filter((entry) => entry.hours > 0);

        if (updatedEntries.length === 0) {
          const { [dayNumber]: _removed, ...rest } = prev;
          return rest;
        }

        return { ...prev, [dayNumber]: updatedEntries };
      }

      if (increment <= 0) {
        return prev;
      }

      const nextEntries = [...existingEntries, { id: createId(), categoryId: selectedCategory.id, hours: increment }];
      return { ...prev, [dayNumber]: nextEntries };
    });
  };

  const handleDayCellKeyDown = (dayNumber: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDayCellClick(dayNumber);
    }
  };

  // Top alert popover: show a message at the top of the page when user attempts actions without selecting a category
  const [topAlert, setTopAlert] = useState<{ message: string; visible: boolean } | null>(null);
  const topAlertTimerRef = useMemo(() => ({ current: 0 as number | undefined }), []);

  const triggerSelectCategoryPopover = (message: string) => {
    setTopAlert({ message, visible: true });
    if (topAlertTimerRef.current) {
      window.clearTimeout(topAlertTimerRef.current);
    }
    topAlertTimerRef.current = window.setTimeout(() => {
      setTopAlert(null);
      topAlertTimerRef.current = undefined;
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (topAlertTimerRef.current) {
        window.clearTimeout(topAlertTimerRef.current);
        topAlertTimerRef.current = undefined;
      }
    };
  }, []);

  const [showHotkeys, setShowHotkeys] = useState(false);

  const handleRemoveEntry = (dayNumber: number, entryId: string) => {
    setDayEntries((prev) => {
      const entries = prev[dayNumber];
      if (!entries) {
        return prev;
      }

      const remaining = entries.filter((entry) => entry.id !== entryId);
      if (remaining.length === 0) {
        const { [dayNumber]: _removed, ...rest } = prev;
        return rest;
      }

      return { ...prev, [dayNumber]: remaining };
    });
  };

  // Keyboard helpers: Alt-held flips sign while pressed, Z/X cycle categories
  useEffect(() => {
    let altDown = false;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
            // Backspace behavior:
            // - If remove button focused -> delete that entry
            // - If a day cell is focused -> remove the selected category's entry on that day (or show popover if none)
            // - Otherwise, if a category is selected -> delete that category
              if (e.key === 'Backspace') { 
              const active = document.activeElement as HTMLElement | null;
              if (active && active.classList.contains('remove-entry')) {
                e.preventDefault();
                (active as HTMLButtonElement).click();
              } else if (active && active.classList.contains('day-cell')) {
                const dayAttr = active.getAttribute('data-day');
                const dayNum = dayAttr ? Number(dayAttr) : NaN;
                if (Number.isFinite(dayNum)) {
                  const entries = dayEntries[dayNum] ?? [];
                  if (selectedCategory) {
                    const found = entries.find((ent) => ent.categoryId === selectedCategory.id);
                    if (found) {
                      e.preventDefault();
                      handleRemoveEntry(dayNum, found.id);
                    } else {
                      e.preventDefault();
                      triggerSelectCategoryPopover('There is nothing to delete for the selected category on this day');
                    }
                  } else {
                    // No category selected: prompt user to select a category before deleting
                    e.preventDefault();
                    triggerSelectCategoryPopover('Select a category to delete an entry from this day');
                  }
                }
              } else {
                if (selectedCategoryId) {
                  e.preventDefault();
                  handleDeleteCategory(selectedCategoryId);
                }
              }
            }
      if (e.key === 'Alt' || e.key === 'AltGraph') {
        if (!altDown) {
          altDown = true;
          setGlobalHoursInput((prev) => {
            const num = Number(prev);
            if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return '0';
            return formatHoursInputValue(-num);
          });
        }
      }

      // Delete clears all entries for a focused day (regardless of selected category)
      if (e.key === 'Delete') {
        const active = document.activeElement as HTMLElement | null;
        if (active && active.classList.contains('day-cell')) {
          const dayAttr = active.getAttribute('data-day');
          const dayNum = dayAttr ? Number(dayAttr) : NaN;
          if (Number.isFinite(dayNum)) {
            e.preventDefault();
            setDayEntries((prev) => {
              if (!prev[dayNum]) return prev;
              const { [dayNum]: _removed, ...rest } = prev;
              saveEntriesToStorage(year, month, rest);
              return rest;
            });
          }
        }
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (visibleCategories.length === 0) return;
        const idx = visibleCategories.findIndex((c) => c.id === selectedCategoryId);
        const nextIdx = (idx + 1) % visibleCategories.length;
        const next = visibleCategories[nextIdx];
        setSelectedCategoryId(next.id);
        setCategoryForm({ name: next.name, rate: String(next.inputRate ?? next.dailyRate ?? '') });
      }

      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (visibleCategories.length === 0) return;
        const idx = visibleCategories.findIndex((c) => c.id === selectedCategoryId);
        const prevIdx = (idx - 1 + visibleCategories.length) % visibleCategories.length;
        const prev = visibleCategories[prevIdx];
        setSelectedCategoryId(prev.id);
        setCategoryForm({ name: prev.name, rate: String(prev.inputRate ?? prev.dailyRate ?? '') });
      }
      if (e.key === 'Escape') {
        if (showHotkeys) {
          setShowHotkeys(false);
        } else {
          // Deselect category when Escape is pressed and hotkeys are not open
          if (selectedCategoryId) {
            setSelectedCategoryId('');
            setCategoryForm({ name: '', rate: '' });
          }
          // Focus the add-category name input to allow quick creation of a new category
          try {
            const el = document.getElementById('category-name') as HTMLInputElement | null;
            if (el) {
              el.focus();
              el.select && el.select();
            }
          } catch (err) {
            // ignore
          }
        }
      }
    };

    const onKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'AltGraph') {
        altDown = false;
        setGlobalHoursInput((prev) => {
          const num = Number(prev);
          if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return '0';
          return formatHoursInputValue(-num);
        });
      }
    };

    window.addEventListener('keydown', onKeyDown as EventListener);
    window.addEventListener('keyup', onKeyUp as EventListener);
    return () => {
      window.removeEventListener('keydown', onKeyDown as EventListener);
      window.removeEventListener('keyup', onKeyUp as EventListener);
    };
  }, [visibleCategories, selectedCategoryId, dayEntries, selectedCategory, triggerSelectCategoryPopover, showHotkeys, year, month]);

  const applyIncrementToDay = (dayNumber: number, increment: number) => {
    if (!selectedCategory) {
      triggerSelectCategoryPopover('Select a category to add hours');
      return;
    }
    if (Math.abs(increment) < 1e-9) return;
    setDayEntries((prev) => {
      const existingEntries = prev[dayNumber] ?? [];
      const existingIndex = existingEntries.findIndex((entry) => entry.categoryId === selectedCategory.id);

      if (existingIndex >= 0) {
        const updated = existingEntries
          .map((entry, idx) => (idx !== existingIndex ? entry : { ...entry, hours: Math.round((entry.hours + increment) * 100) / 100 }))
          .filter((e) => e.hours > 0);

        if (updated.length === 0) {
          const { [dayNumber]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [dayNumber]: updated };
      }

      if (increment <= 0) return prev;

      return { ...prev, [dayNumber]: [...existingEntries, { id: createId(), categoryId: selectedCategory.id, hours: increment }] };
    });
  };

  const handleFillWeekdays = (week: (number | null)[]) => {
    const increment = Math.round(parsedGlobalHours * 100) / 100;
    if (!selectedCategory) {
      triggerSelectCategoryPopover('Select a category to fill weekdays');
      return;
    }
    if (Math.abs(increment) < 1e-9) return;
    const daysToUpdate = week.filter((d) => d !== null && d > 0 && d <= daysInMonth) as number[];
    setDayEntries((prev) => {
      const next = { ...prev };
      daysToUpdate.forEach((day) => {
        const weekday = new Date(year, month, day).getDay();
        if (weekday === 0 || weekday === 6) return; // skip Sunday(0)/Saturday(6)
        const existing = next[day] ?? [];
        const idx = existing.findIndex((e) => e.categoryId === selectedCategory!.id);
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], hours: Math.round((existing[idx].hours + increment) * 100) / 100 };
        } else if (increment > 0) {
          existing.push({ id: createId(), categoryId: selectedCategory!.id, hours: increment });
        }
        next[day] = existing.filter((e) => e.hours > 0);
        if (next[day].length === 0) delete next[day];
      });
      return next;
    });
  };

  const handleFillWeek = (week: (number | null)[]) => {
    const increment = Math.round(parsedGlobalHours * 100) / 100;
    if (!selectedCategory) {
      triggerSelectCategoryPopover('Select a category to fill week');
      return;
    }
    if (Math.abs(increment) < 1e-9) return;
    const daysToUpdate = week.filter((d) => d !== null && d > 0 && d <= daysInMonth) as number[];
    setDayEntries((prev) => {
      const next = { ...prev };
      daysToUpdate.forEach((day) => {
        const existing = next[day] ?? [];
        const idx = existing.findIndex((e) => e.categoryId === selectedCategory!.id);
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], hours: Math.round((existing[idx].hours + increment) * 100) / 100 };
        } else if (increment > 0) {
          existing.push({ id: createId(), categoryId: selectedCategory!.id, hours: increment });
        }
        next[day] = existing.filter((e) => e.hours > 0);
        if (next[day].length === 0) delete next[day];
      });
      return next;
    });
  };

  useEffect(() => {
    saveEntriesToStorage(year, month, dayEntries);
  }, [dayEntries, month, year]);

  const handleMonthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMonth(Number(event.target.value));
  };

  const handleYearChange = (event: ChangeEvent<HTMLInputElement>) => {
    setYear(Number(event.target.value));
  };

  const handleCategoryNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCategoryForm((prev) => ({ ...prev, name: event.target.value }));
  };

  const handleCategoryRateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCategoryForm((prev) => ({ ...prev, rate: event.target.value }));
  };

  const handleGlobalHoursChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGlobalHoursInput(event.target.value);
  };

  const handleIncrementHours = (delta: number) => {
    setGlobalHoursInput((prev) => {
      const base = Number(prev);
      const next = (Number.isFinite(base) ? base : 0) + delta;
      if (Math.abs(next) < 1e-9) {
        return '0';
      }
      return formatHoursInputValue(next);
    });
  };

  const handleFlipHours = () => {
    setGlobalHoursInput((prev) => {
      const value = Number(prev);
      if (!Number.isFinite(value) || Math.abs(value) < 1e-9) {
        return '0';
      }
      return formatHoursInputValue(-value);
    });
  };

  const handleClearHours = () => {
    setGlobalHoursInput('0');
  };

  return (
    <main className={`app theme-${theme}`}>
      {topAlert?.visible ? (
        <div className="top-popover" role="alert" aria-live="assertive">
          <FiAlertTriangle className="alert-icon" aria-hidden="true" />
          <span className="alert-text">{topAlert.message}</span>
        </div>
      ) : null}
      <div className="left-panel">
        <div className="site-title">
          <div className="title-block">
            <h1>Houwaz</h1><sub>Time Tracking Calendar</sub>
            <hr/>
            <div className="theme-toggle" role="group" aria-label="Theme selection">
              <button
                type="button"
                className={`theme-toggle-button${theme === 'default' ? ' active' : ''}`}
                aria-pressed={theme === 'default'}
                onClick={() => setTheme('default')}
              >
                Default
              </button>
              <button
                type="button"
                className={`theme-toggle-button${theme === 'fun' ? ' active' : ''}`}
                aria-pressed={theme === 'fun'}
                onClick={() => setTheme('fun')}
              >
                Fun
              </button>
            </div>
          </div>
          <div className="site-actions">
            <a href="https://github.com/tellous/houwaz" target="_blank" rel="noopener noreferrer" aria-label="Open GitHub repository">
              <FiGithub size={20} />
            </a>
            <button
              type="button"
              className="help-button"
              onClick={() => setShowHotkeys((s) => !s)}
              aria-haspopup="dialog"
              aria-expanded={showHotkeys}
              aria-label="Show keyboard shortcuts"
            >
              <FiHelpCircle size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <header className="toolbar">
          <div className="month-picker">
            <label className="field">
              <span>Month</span>
              <select value={month} onChange={handleMonthChange}>
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Year</span>
              <input type="number" value={year} min={1970} max={2100} onChange={handleYearChange} />
            </label>
          </div>
          <section className="totals">
            <h2>Total</h2>
            <div className="total-meta">
              <span className="total-amount">{formatMoney(grandTotal)}</span>
              <span className="total-hours">{formatNum(grandHours)} hrs</span>
            </div>
          </section>
        </header>

        {showHotkeys ? (
          <div className="hotkeys-popover" role="dialog" aria-label="Keyboard shortcuts">
            <div className="hotkeys-header">
              <strong>Hotkeys</strong>
              <button type="button" className="hotkeys-close" onClick={() => setShowHotkeys(false)} aria-label="Close">
                <FiX aria-hidden="true" />
              </button>
            </div>
            <table className="hotkeys-table" role="grid" aria-label="Keyboard shortcuts table">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Z</strong></td>
                  <td>Select the next visible category (wraps around).</td>
                </tr>
                <tr>
                  <td><strong>X</strong></td>
                  <td>Select the previous visible category (wraps around).</td>
                </tr>
                <tr>
                  <td><strong>Alt</strong></td>
                  <td>Hold to temporarily flip the Hours Input sign; release to restore.</td>
                </tr>
                <tr>
                  <td><strong>Enter / Space</strong></td>
                  <td>Activate the focused control (toggle/select/add/delete).</td>
                </tr>
                <tr>
                  <td><strong>Backspace</strong></td>
                  <td>When a day is focused, removes the entry for the selected category (prompts if none). When a delete button is focused, Backspace removes that entry.</td>
                </tr>
                <tr>
                  <td><strong>Delete</strong></td>
                  <td>Clear all entries for the focused day.</td>
                </tr>
                <tr>
                  <td><strong>Esc</strong></td>
                  <td>Close the help popup, or deselect the current category and focus the add-category Name input if popup is not open.</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="hours-card">
            <h2>Hours Input</h2>
            <div className="hours-selector">
              <div className="field hours-field">
                <div className="hours-input-row">
                  <div className="hours-buttons compact">
                    <button type="button" className="hours-button neg" onClick={() => handleIncrementHours(-1)}>
                      -1
                    </button>
                    <button type="button" className="hours-button neg" onClick={() => handleIncrementHours(-0.5)}>
                      -0.5
                    </button>
                    <input
                      id="global-hours"
                      type="number"
                      step="0.25"
                      value={globalHoursInput}
                      onChange={handleGlobalHoursChange}
                      className={hoursInputClass}
                      placeholder="e.g. 1.5"
                    />
                    <button type="button" className="hours-button" onClick={() => handleIncrementHours(0.5)}>
                      +0.5
                    </button>
                    <button type="button" className="hours-button" onClick={() => handleIncrementHours(1)}>
                      +1
                    </button>
                  </div>
                </div>
                <div className="hours-control-row">
                  <div className="hours-buttons compact">
                    <button type="button" className="hours-button flip" onClick={handleFlipHours}>
                      Flip ±
                    </button>
                    <button type="button" className="hours-button clear" onClick={handleClearHours}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        <div className="category-summary">
            <div className="category-summary-header">
              <h2>Project Category</h2>
            </div>

            <form className="category-form inline" onSubmit={handleCategoryFormSubmit}>
              <div className="compact-fields">
                <div className="field">
                  <label htmlFor="category-name">Name</label>
                  <input
                    id="category-name"
                    type="text"
                    value={categoryForm.name}
                    onChange={handleCategoryNameChange}
                    placeholder="e.g. Consulting"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="category-rate">Rate</label>
                  <input
                    id="category-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={categoryForm.rate}
                    onChange={handleCategoryRateChange}
                    placeholder="500"
                    required
                  />
                </div>
              </div>
              <div className="form-button-row">
                <button type="submit" className="compact-add">
                  {selectedCategoryId ? 'Save' : 'Add'}
                </button>
                {selectedCategoryId ? (
                  <button type="button" className="hours-button clear" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                ) : null}
              </div>
              <hr />
            </form>

            {categorySummaries.length === 0 ? (
              <p className="empty">Add a category to begin tracking totals.</p>
            ) : (
              <ul>
                {categorySummaries.map(({ category, dayCount, hoursTotal, amountTotal }) => {
                  const isSelected = category.id === selectedCategoryId;
                  return (
                    <li key={category.id} className={isSelected ? 'selected' : ''}>
                      <div className={`category-summary-card${isSelected ? ' selected' : ''}`}>
                                <div
                                  className={`category-summary-item`}
                                  onClick={() => handleCategorySelect(category.id)}
                                >
                                  <div className="category-summary-top">
                                    <div className="category-select-wrap">
                                      <button
                                        type="button"
                                        className={`category-select${isSelected ? ' selected' : ''}`}
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          // toggle selection: deselect if already selected
                                          if (isSelected) {
                                            setSelectedCategoryId('');
                                            setCategoryForm({ name: '', rate: '' });
                                          } else {
                                            handleCategorySelect(category.id);
                                          }
                                        }}
                                        aria-pressed={isSelected}
                                        aria-label={isSelected ? `Deselect ${category.name}` : `Select ${category.name}`}
                                      >
                                        {isSelected ? (
                                          <FiCheckCircle aria-hidden="true" />
                                        ) : (
                                          <FiCircle aria-hidden="true" />
                                        )}
                                      </button>
                                    </div>
                                    <div className="category-summary-meta">
                                      <strong>{category.name}</strong>
                                      <div className="category-rate-block">
                                        <span className="category-rate">@ {formatMoney(category.dailyRate)}</span>
                                      </div>
                                    </div>
                                    <div className="category-amount-block">
                                      <span className="category-amount">{formatMoney(amountTotal)}</span>
                                      <span className="category-hours-under-amount">{formatNum(hoursTotal)} hrs</span>
                                    </div>
                                  </div>
                                  <div className="category-actions">
                                    <div style={{display: 'flex', gap: '0.5rem', width: '100%'}}>
                                      <button
                                        type="button"
                                        className="category-visibility"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleCategoryVisibility(category.id);
                                        }}
                                        aria-label={category.hidden ? `Show ${category.name}` : `Hide ${category.name}`}
                                      >
                                        {category.hidden ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                                      </button>
                                      <button
                                        type="button"
                                        className="category-delete"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDeleteCategory(category.id);
                                        }}
                                        aria-label={`Delete ${category.name}`}
                                      >
                                        <FiTrash2 aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
      </div>

      <section className="calendar">
        <div className="weekday-row">
          <div className="weekday-spacer" />
          <div className="weekday-total-spacer" />
          {weekdays.map((weekday) => (
            <div key={weekday} className="weekday">
              {weekday}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {weeks.map((week, wIdx) => (
            <div key={`week-${wIdx}`} className="week-row">
              <div className="week-actions vertical">
                <button
                  type="button"
                  className="week-action"
                  onClick={() => handleFillWeekdays(week)}
                  title="Fill weekdays"
                  aria-label="Fill weekdays"
                >
                  <FiGrid className="icon ri-weekday" aria-hidden="true" />
                  <span className="week-action-label">Weekdays</span>
                </button>
                <button
                  type="button"
                  className="week-action"
                  onClick={() => handleFillWeek(week)}
                  title="Fill week"
                  aria-label="Fill week"
                >
                  <FiCalendar className="icon ri-fill-week" aria-hidden="true" />
                  <span className="week-action-label">Week</span>
                </button>
                <button
                  type="button"
                  className="week-action"
                  onClick={() => handleResetWeek(week)}
                  title="Reset week"
                  aria-label="Reset week"
                >
                  <FiRefreshCw className="icon ri-reset-week" aria-hidden="true" />
                  <span className="week-action-label">Reset</span>
                </button>
              </div>
              <div className="week-total">
                {weeklyDollars[wIdx] > 0 ? <div className="week-dollars">{formatMoney(weeklyDollars[wIdx])}</div> : null}
                {weeklyHours[wIdx] > 0 ? <div className="week-hours">{formatNum(weeklyHours[wIdx])} hrs</div> : null}
              </div>
              {week.map((dayNumber, index) => {
                if (dayNumber === null) {
                  return <div key={`empty-${wIdx}-${index}`} className="day-cell empty" />;
                }

                const entries = dayEntries[dayNumber] ?? [];
                const dayTotal = calculateDayTotal(entries);
                const dayHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
                const cellClassName = `day-cell${hasUsableSelection ? ' is-clickable' : ''}${entries.length > 0 ? ' has-entries' : ''}`;

                return (
                  <div
                    key={`day-${dayNumber}`}
                    className={cellClassName}
                    data-day={dayNumber}
                    onMouseDown={(e) => {
                      (e.currentTarget as HTMLElement).focus();
                    }}
                    onClick={(e) => {
                      (e.currentTarget as HTMLElement).focus();
                      handleDayCellClick(dayNumber);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={handleDayCellKeyDown(dayNumber)}
                  >
                    <div className="day-header">
                      <div className="day-left">
                        <span className="day-number">{dayNumber}</span>
                      </div>
                      <div className="day-right">
                        {dayTotal > 0 && <div className="day-total">${dayTotal.toFixed(2)}</div>}
                        {dayHours > 0 && <div className="day-hours-under">{dayHours.toFixed(2)} hrs</div>}
                      </div>
                    </div>
                                    {/* per-day popover removed; top alert handled globally */}
                    {entries.length === 0 ? (
                      <p className="empty-day">No Entries</p>
                    ) : (
                      <div className="day-entries" onClick={(event) => event.stopPropagation()}>
                        {entries.map((entry) => {
                          const entryCategory = categories.find((cat) => cat.id === entry.categoryId);
                          if (!entryCategory || entryCategory.hidden) {
                            return null;
                          }

                          const entryTotal = entry.hours * entryCategory.dailyRate;

                          return (
                            <div key={entry.id} className="day-entry">
                              <div className="entry-header">
                                <span className="entry-name">{entryCategory.name}</span>
                              </div>
                              <div className="entry-compact">
                                <span>
                                  {entry.hours.toFixed(2)} hrs
                                </span>
                                <span>${entryTotal.toFixed(2)}</span>
                              </div>
                              <div className="entry-actions">
                                <button
                                  type="button"
                                  className="remove-entry"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRemoveEntry(dayNumber, entry.id);
                                  }}
                                  onKeyDown={(event) => {
                                    // allow Enter or Space to activate delete when focused
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleRemoveEntry(dayNumber, entry.id);
                                    }
                                  }}
                                  aria-label={`Remove ${entryCategory.name} from ${monthNames[month]} ${dayNumber}`}
                                >
                                  <FiTrash2 aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

      </section>
    </main>
  );
}

export default App;
