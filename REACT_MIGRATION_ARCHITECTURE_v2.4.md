# ProfitBox v2.4 → React архитектура (практический проект миграции)

## 1) Предлагаемый стек и почему

- **React 18 + TypeScript + Vite**
  - Быстрый dev/start/build, минимальный overhead для SPA.
  - TypeScript критичен для безопасной миграции из монолита в типизированные модули.
- **React Router v6+**
  - Явное URL-состояние вкладок (`/catalog`, `/history`, `/analytics`, `/stock`, `/notes`).
  - Сохраняет deep-link и облегчает QA/автотесты.
- **Zustand (+ middleware persist/devtools/subscribeWithSelector)**
  - Выбран вместо Redux Toolkit, потому что:
    - в текущем приложении много локальных action-переходов и derivation, но нет сложного async API-оркестратора;
    - меньше бойлерплейта для поэтапной миграции (strangler pattern);
    - удобно разделять store по слайсам и постепенно подключать legacy-логику.
  - При необходимости можно позже добавить RTK Query/Redux только для серверного API, если появится backend.
- **Vitest + Testing Library + Playwright**
  - Unit/contract тесты бизнес-логики, component/e2e для мобильного UX и layout parity.
- **Recharts или Apache ECharts (через адаптер)**
  - Подготовка под продвинутые графики: слой `charts/adapters/*` позволит заменить движок без переписывания селекторов.

---

## 2) Структура папок проекта

```txt
src/
  app/
    providers/
      router.tsx
      theme-provider.tsx
      store-provider.tsx
    App.tsx
    main.tsx

  pages/
    catalog/
      CatalogPage.tsx
    history/
      HistoryPage.tsx
    analytics/
      AnalyticsPage.tsx
    stock/
      StockPage.tsx
    notes/
      NotesPage.tsx

  widgets/
    app-shell/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
      MobileNav.tsx
      SidebarOverlay.tsx
    catalog/
      ProductForm.tsx
      ProductTable.tsx
      ProductCardList.tsx
      ProductFilters.tsx
    history/
      HistoryToolbar.tsx
      SalesForm.tsx
      SupplyForm.tsx
      ExpenseForm.tsx
      HistoryTable.tsx
      HistoryCardList.tsx
    analytics/
      KpiCards.tsx
      RangeSelector.tsx
      RevenueProfitChart.tsx
      TopProductsChart.tsx
      FolderProfitChart.tsx
    stock/
      StockFilters.tsx
      StockTable.tsx
      StockCardList.tsx
      ThresholdEditor.tsx
    notes/
      NotesList.tsx
      NoteEditor.tsx
    modals/
      FolderModal.tsx
      BackupModal.tsx
      DocsModal.tsx
      ConfirmModal.tsx

  features/
    products/
      model.ts
      selectors.ts
      actions.ts
    folders/
      model.ts
      selectors.ts
      actions.ts
    operations/
      model.ts          # saleDocs/supplyDocs/expenseOps
      selectors.ts
      actions.ts
    notes/
      model.ts
      selectors.ts
      actions.ts
    ui/
      model.ts          # tab, sidebar state, theme, mobile flags
      selectors.ts

  store/
    index.ts            # zustand root store
    slices/
      data-slice.ts
      ui-slice.ts
      session-slice.ts
    selectors/
      analytics.selectors.ts
      stock.selectors.ts
      history.selectors.ts
      sidebar.selectors.ts

  services/
    domain/
      profit.service.ts
      stock.service.ts
      history.service.ts
      analytics.service.ts
      notes.service.ts
    storage/
      schema.ts
      migration-registry.ts
      local-storage.repository.ts
      backup.repository.ts
      import-export.service.ts
      image.repository.ts # phase 2: IndexedDB
    charts/
      adapter.ts
      recharts.adapter.ts

  hooks/
    useResponsiveLayout.ts
    useLandscapePhoneMode.ts
    useAutosave.ts
    useBackupScheduler.ts
    useKeyboardShortcuts.ts
    useImportExport.ts

  shared/
    ui/
      Button/
      Input/
      Select/
      Modal/
      Card/
      Table/
      Tabs/
      Toast/
    lib/
      date.ts
      number.ts
      currency.ts
      guards.ts
      ids.ts
    config/
      breakpoints.ts
      routes.ts
      themes.ts
    styles/
      tokens.css
      base.css
      layout.css
      components.css
      states.css

  legacy/
    v24-compat/
      mappers.ts
      parity-check.ts
```

---

## 3) Сущности данных и TypeScript-типы

```ts
export type ID = number;
export type ISODate = string; // YYYY-MM-DD

export interface Folder {
  id: ID;
  name: string;
  color: string;
}

export interface Product {
  id: ID;
  name: string;
  article: string;
  wholesale: number;
  retail: number;
  qty: number;            // накопленный приход / базовое количество
  stock: number;          // текущий остаток
  expenses: number;       // базовые (карточка) расходы
  folderId: ID | null;
  minStock: number;
  minStockEnabled: boolean;
  notes: string;
  image: string;          // phase1: dataURL, phase2: imageRef
}

export interface SaleLine {
  id: ID;
  productId: ID;
  qty: number;
  price: number;
  discount: number;
  note: string;
  costAtSale: number;
  retailAtSale: number;
  discountAtSale: number;
  profitAtSale: number;
}

export interface SaleDoc {
  id: ID;
  date: ISODate;
  customer: string;
  note: string;
  items: SaleLine[];
}

export interface SupplyLine {
  id: ID;
  productId: ID;
  qty: number;
  price: number;
  note: string;
}

export interface SupplyDoc {
  id: ID;
  date: ISODate;
  supplier: string;
  note: string;
  items: SupplyLine[];
}

export interface ExpenseOp {
  id: ID;
  productId: ID | null;
  amount: number;
  date: ISODate;
  category: string;
  source: string;
  note: string;
  legacy?: boolean;
}

export interface CustomNote {
  id: ID;
  date: ISODate;
  title: string;
  text: string;
}

export type ThemeName =
  | 'dark' | 'light' | 'ocean' | 'purple' | 'ruby' | 'emerald' | 'sunset';

export interface AnalyticsRange {
  mode: 'today' | '7d' | '30d' | 'custom';
  from: ISODate | '';
  to: ISODate | '';
}

export interface HistoryFilters {
  type: 'all' | 'sales' | 'purchases' | 'expenses';
  productId: ID | '';
  folderId: ID | '';
  from: ISODate | '';
  to: ISODate | '';
  sort:
    | 'date_desc' | 'date_asc'
    | 'amount_desc' | 'amount_asc'
    | 'qty_desc' | 'qty_asc'
    | 'profit_desc' | 'profit_asc';
}

export interface StockFilters {
  folderId: ID | 'all';
  problemOnly: boolean;
  groupByFolder: boolean;
  sort:
    | 'stock_asc' | 'stock_desc'
    | 'qty_desc'
    | 'wholesale_desc' | 'retail_desc'
    | 'stockWholesale_desc' | 'stockRetail_desc';
}

export interface Counters {
  nextId: number;
  nextFolderId: number;
  nextSaleDocId: number;
  nextSupplyDocId: number;
  nextSaleLineId: number;
  nextSupplyLineId: number;
  nextExpenseId: number;
  nextCustomNoteId: number;
}

export interface ProfitBoxStateV6 {
  schemaVersion: 6;
  products: Product[];
  folders: Folder[];
  saleDocs: SaleDoc[];
  supplyDocs: SupplyDoc[];
  expenseOps: ExpenseOp[];
  customNotes: CustomNote[];
  analyticsRange: AnalyticsRange;
  historyFilters: HistoryFilters;
  stockFilters: StockFilters;
  discountType: 'currency' | 'percent';
  theme: ThemeName;
  counters: Counters;
}
```

---

## 4) Что выносить по слоям

### `services`
- **domain/**
  - расчёты прибыли/маржи/дельт;
  - rebuild flat-проекций из документов;
  - вычисление остатков, low-stock, period KPI;
  - правила undo/redo действий.
- **storage/**
  - `load/save`, миграции версий, backup rotation (до 10 копий), import/export JSON/CSV/XLS;
  - phase2: вынести изображения в IndexedDB и хранить ссылки в state.

### `hooks`
- `useResponsiveLayout` (mobile/tablet/desktop);
- `useLandscapePhoneMode` (синхронизация поведения класса `layout-landscape-phone`);
- `useAutosave` (debounce + safe persist);
- `useBackupScheduler` (автобэкап каждые 2 часа);
- `useImportExport` (UI glue над storage services).

### `store`
- slices: `data`, `ui`, `session`;
- actions: CRUD товаров/папок/операций/заметок;
- derive через memoized selectors, а не в компонентах.

### `utils` (`shared/lib`)
- форматирование валюты/процентов;
- date helpers (`isoToday`, `normalizeDate`, range helpers);
- guards/валидация;
- ID утилиты и безопасные clamp-функции.

### `pages`
- только orchestration уровня вкладки + layout composition;
- без тяжёлых вычислений и без прямой работы с localStorage.

### `widgets`
- крупные блоки UI (таблица каталога, форма продаж, фильтры склада, KPI analytics, mobile nav).

### `shared/ui`
- атомарные компоненты (button/input/modal/table/card/tabs/toast), единая визуальная библиотека.

---

## 5) Миграция CSS без потери mobile UX

### Что оставить как design tokens
- Все текущие CSS-переменные из `:root` + темы (`theme-light/ocean/purple/...`) переносим в `tokens.css`.
- Токены группируем:
  - color (`--bg`, `--s1`, `--text`, semantic `--green`, `--red`);
  - spacing/radius/shadow;
  - typography;
  - z-index слои (topbar/sidebar/modal/mobile-nav).

### Как сохранить media queries и mobile-first
- Сначала перенос **1:1**, без переосмысления брейкпоинтов:
  - base mobile styles (по умолчанию),
  - `@media (min-width: 768px)` tablet,
  - `@media (min-width: 1024px)` desktop,
  - `@media (orientation: landscape) and (max-width: 900px)` landscape phone.
- Брейкпоинты вынести в `shared/config/breakpoints.ts` + продублировать в CSS как custom media (на втором шаге).

### Как не потерять состояния desktop/tablet/mobile/landscape
- В `AppShell` выставлять data-атрибуты:
  - `data-layout="mobile|tablet|desktop"`
  - `data-orientation="portrait|landscape"`
  - `data-landscape-phone="true|false"`
- На этапе parity временно поддержать body-класс `layout-landscape-phone` (совместимость 1:1).
- Визуальные smoke-тесты на 4 viewport профиля обязательны в CI.

---

## 6) План миграции по компонентам (поэтапно)

### Этап A — Shell/навигация
1. **MobileNav** (первым):
   - перенести кнопки вкладок и активное состояние;
   - сохранить safe-area и sticky bottom поведение.
2. **Sidebar + SidebarOverlay**:
   - мобильное открытие/закрытие, счетчики и список папок;
   - без изменения бизнес-логики.
3. **Topbar**:
   - заголовки вкладок, темы, импорт/экспорт кнопки.

### Этап B — Вкладки ядра
4. **Catalog**:
   - ProductForm, ProductTable, ProductCardList (card mode на узких экранах);
   - поиск/сортировка/CRUD/дублирование/быстрая продажа.
5. **History**:
   - switcher sales/purchases/expenses;
   - фильтры, формы, таблица+карточки.
6. **Stock**:
   - фильтры, таблица/карточки, порог minStock и бейджи статусов.

### Этап C — Аналитика и заметки
7. **Analytics**:
   - date-range selector, KPI, графики через selector слой.
8. **Notes**:
   - ручные заметки + агрегированные заметки из операций.

### Этап D — Модалки и сервисный функционал
9. **Modals**:
   - FolderModal, BackupModal, DocsModal, ConfirmModal.
10. Import/Export/Backup:
   - UI в modals/topbar, логика в `services/storage`.

> Важно: на каждом шаге использовать feature-флаг `useReact<Feature>` и сохранять возможность отката на legacy-рендер конкретной вкладки.

---

## 7) Инварианты (должны работать 1:1 после миграции)

1. **Данные и миграции**
   - загрузка старых ключей localStorage и корректная нормализация;
   - `saleDocs/supplyDocs` остаются source of truth.
2. **Финансовая логика**
   - `profitAtSale/costAtSale` снапшоты не пересчитываются задним числом;
   - метрики выручки/расходов/прибыли совпадают с текущей версией.
3. **Склад**
   - продажа уменьшает остаток;
   - поставка увеличивает накопленный qty и влияет на склад;
   - low/out-of-stock статусы и пороги идентичны.
4. **UX и адаптив**
   - mobile-first карточный режим таблиц на узких экранах;
   - нижняя mobile-nav всегда доступна в портрете;
   - landscape phone split layout работает как сейчас.
5. **Операции с данными**
   - экспорт/импорт/backup/restore без потерь и с теми же форматами;
   - автосохранение и уведомление «сохранено» сохраняют текущий сценарий.
6. **Навигация/вкладки**
   - все текущие вкладки и сценарии доступны и функционально эквивалентны.

---

## Практический roadmap (не переписывать всё сразу)

- **Спринт 1:** подготовить TS-модель, storage/migrations слой, селекторы аналитики/склада, пустой React Shell.
- **Спринт 2:** перенести MobileNav/Sidebar/Topbar + Catalog.
- **Спринт 3:** History + Stock.
- **Спринт 4:** Analytics + Notes + Modals + export/import/backup UI.
- **Спринт 5:** performance pass, визуальный regression, подготовка к chart-upgrade и IndexedDB для изображений.

