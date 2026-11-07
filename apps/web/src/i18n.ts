export const messages = {
  ru: {
    districtRefreshCatalog: "Получить все районы из Сатурна",
    districtCatalogUpdated: "Справочник районов сохранён",
    districtCatalogCount: "Районов в списке",
    districtCatalogMissing:
      "Полный справочник пока не загружен: доступен Ярцевский район. Нажмите «Получить все районы».",
    districtArchiveCount: "Уникальных центров полей в общем кэше района",
    districtArchiveNote:
      "Синие точки показывают ранее сохранённый индекс, независимо от выбранных дат и квадрата. Это не сведения о выполненных обработках.",
    districtPanelTitle: "Загрузить данные по району",
    districtSteps:
      "1. Один раз получите справочник районов. 2. Выберите район и нужную часть карты. 3. Укажите период до 124 дней и нажмите «Получить ещё до 10 записей».",
    districtSelect: "Район Смоленской области",
    districtChoose: "Выберите район…",
    districtYartsevo: "Ярцевский район",
    districtFrom: "Обновления карты с",
    districtTo: "Обновления карты по",
    districtCheck: "Проверить кэш",
    districtFetch: "Получить ещё до 10 записей",
    districtBusy: "Загружаем…",
    districtHint:
      "Запрос касается только видимой части карты. За одно нажатие загружается одна страница (до 10 записей). Повторное нажатие продолжит загрузку. Это индекс точек полей, не полигоны и не подтверждённые обработки.",
    districtBoundsHint:
      "Выберите район и приблизьте карту: доступен квадрат не больше 1° × 1° внутри пилотной области, период до 124 дней.",
    districtDisabled:
      "Загрузка выключена на сервере. Администратор должен разрешить пилотный доступ к источнику.",
    districtLocalOnly:
      "Загрузка доступна только в локальном пилотном приложении.",
    districtThrottle:
      "Сатурн: пауза между запросами не меньше 20 секунд. Повторите позже.",
    districtLoadFailed:
      "Не удалось получить страницу. Сохранённый прогресс не удалён.",
    districtNoPages: "Для выбранного квадрата пока нет сохранённых страниц.",
    districtPageCount: "Страниц",
    districtItemsCount: "Записей индекса",
    districtComplete:
      "Все страницы этого квадрата получены; полнота района неизвестна.",
    districtPartial:
      "Загрузка квадрата не завершена. Следующая порция сохраняется по явному нажатию после паузы источника.",
    districtDatesInvalid:
      "Недопустимый период: даты должны быть корректны, начальная дата — не позже конечной, интервал не более 124 дней. Весь год пока загружается отдельными периодами.",
    districtLimitDates: "Оставить последние 124 дня периода",
    districtCacheSaved:
      "Данные сохранены в PostgreSQL и повторно читаются из общего кэша.",
    districtCachedPreview: "Синих точек центров полей на карте (максимум 100)",
    districtCacheKeyNote:
      "Кэш зависит от точных границ карты и периода. При их изменении это другой запрос; ранее сохранённые данные остаются в БД и видны в Admin → Загрузка данных. Синие точки — индекс полей, не места обработки.",
    districtStaleRevision:
      "Версия источника изменилась. Старые записи доступны для просмотра, но продолжение этого запроса заблокировано.",
    districtPointTooltip: "Центр поля из кэша Сатурна, ID",

    navigation: "Навигация",
    mapNav: "Карта",
    help: "Помощь",
    helpLoading: "Загружаем руководство…",
    helpLoadError:
      "Не удалось загрузить руководство. Проверьте подключение и повторите попытку.",
    helpRetry: "Повторить загрузку",
    backToMap: "Вернуться к карте",
    appTitle: "MelliAtlas",
    appSubtitle: "Карта для пчеловодов",
    map: "Карта обработок",
    locationInfo: "Информация о территории",
    treatmentDetails: "Информация об участке",
    chooseTreatment:
      "Выберите поле на карте, чтобы увидеть сведения об обработках.",
    closeDetails: "Закрыть сведения об участке",
    contractor: "Организация",
    crop: "Культура",
    beeHazardClass: "Класс опасности для пчёл (по данным источника)",
    noProducts: "Препараты не указаны",
    cadastralNumbers: "Кадастровые номера",
    overview: "Обзор территории",
    layers: "Слои",
    treatments: "Планы обработок",
    sourceReviewNotice:
      "Показаны данные источников, включая записи без независимой проверки. Это не оценка опасности для пчёл.",
    syntheticDataNotice:
      "ДЕМОДАННЫЕ: все поля, планы и статусы вымышлены. Это не сведения Сатурн и не оценка опасности.",
    noTreatments:
      "Полигонов обработок пока нет. Отсутствие сведений не означает отсутствие обработок.",
    mapLoadError: "Не удалось загрузить слой обработок.",
    loading: "Загрузка карты…",
    refresh: "Обновить карту",
    polygonCount: "Полигонов",
    mapLimitNotice:
      "Показано не более 200 полигонов в видимой области. Приблизьте карту, чтобы уточнить выборку.",
    mapSource: "Основа карты: OpenStreetMap",
    inspectedPoint: "Выбранная точка",
    selectPoint:
      "Нажмите на карту, чтобы посмотреть прогноз погоды для выбранной точки.",
    weather: "Погода в выбранной точке",
    weatherSource: "Прогнозная модель, не оценка опасности обработок.",
    weatherLoading: "Запрашиваем прогноз…",
    weatherError: "Метеоданные временно недоступны.",
    retry: "Повторить",
    temperature: "Температура",
    humidity: "Влажность",
    wind: "Ветер",
    precipitation: "Осадки",
    forecastTime: "Время прогноза",
    retrievedAt: "Получено",
    source: "Источник",
    noPoint: "Точка не выбрана",
    radius: "Радиус обзора",
    radiusVisualizationOnly:
      "Пока круг только обозначает область: поиск в Сатурн по радиусу ещё не подключён.",
    selected: "Выбрано",
    unverified: "Не проверено. Не является оценкой безопасности.",
    verified: "Проверено оператором. Не является оценкой безопасности.",
    cadastral: "Кадастр",
    period: "Период",
    substance: "Препарат",
    unknown: "Не указан",
    original: "Открыть первоисточник",
    language: "Язык",
    pilot: "Пилотная территория",
  },
  en: {
    districtRefreshCatalog: "Fetch all districts from Saturn",
    districtCatalogUpdated: "District directory saved",
    districtCatalogCount: "Districts in selector",
    districtCatalogMissing:
      "The full directory is not downloaded yet; only Yartsevo is available. Fetch all districts first.",
    districtArchiveCount: "Unique cached field centers in this district",
    districtArchiveNote:
      "Blue markers show previously cached index points across all saved filters. They are not evidence of pesticide application.",
    districtPanelTitle: "Load district data",
    districtSteps:
      "1. Fetch the district directory once. 2. Choose a district and date range. 3. Zoom in and load the next batch of up to 10 fields.",
    districtSelect: "Smolensk Oblast district",
    districtChoose: "Select a district…",
    districtYartsevo: "Yartsevo District",
    districtFrom: "Map updates from",
    districtTo: "Map updates through",
    districtCheck: "Check cache",
    districtFetch: "Fetch up to 10 more records",
    districtBusy: "Loading…",
    districtHint:
      "Only the visible map rectangle is requested. Each click loads one page (up to 10 index entries); another click resumes. These are field centers, not polygons or confirmed treatments.",
    districtBoundsHint:
      "Choose a district and zoom in: the maximum rectangle is 1° × 1° within the pilot region, and the period is at most 124 days.",
    districtDisabled:
      "Server-side collection is disabled. An operator must enable authorized pilot access.",
    districtLocalOnly:
      "Collection is available only in the local pilot application.",
    districtThrottle:
      "Saturn: wait at least 20 seconds between upstream requests and try again.",
    districtLoadFailed:
      "Unable to fetch the page. Previously saved progress is retained.",
    districtNoPages: "No saved pages for this rectangle yet.",
    districtPageCount: "Pages",
    districtItemsCount: "Index entries",
    districtComplete:
      "All pages of this rectangle loaded; district completeness is unknown.",
    districtPartial:
      "This rectangle is not yet complete. Fetch the next batch explicitly after the provider cooldown.",
    districtDatesInvalid:
      "Invalid dates: the start must not exceed the end and a single window is limited to 124 days. Split a year into separate windows.",
    districtLimitDates: "Keep the last 124 days of this range",
    districtCacheSaved:
      "Saved in PostgreSQL; repeat reads use the shared cache.",
    districtCachedPreview: "Blue cached field-center points shown (up to 100)",
    districtCacheKeyNote:
      "The cache key includes exact map bounds and dates. Changing either creates a different request; earlier entries remain in PostgreSQL under Admin → Data collection. Blue dots are a field index, not spraying locations.",
    districtStaleRevision:
      "The source revision changed. Saved records remain readable, but this request cannot resume.",
    districtPointTooltip: "Cached Saturn field center, ID",

    navigation: "Navigation",
    mapNav: "Map",
    help: "Help",
    helpLoading: "Loading the guide…",
    helpLoadError:
      "The guide could not be loaded. Check your connection and try again.",
    helpRetry: "Retry loading",
    backToMap: "Return to map",
    appTitle: "MelliAtlas",
    appSubtitle: "Map for beekeepers",
    map: "Treatment map",
    locationInfo: "Area information",
    treatmentDetails: "Field details",
    chooseTreatment:
      "Select a field on the map to inspect the treatment information.",
    closeDetails: "Close field details",
    contractor: "Organization",
    crop: "Crop",
    beeHazardClass: "Bee hazard class (as reported by the source)",
    noProducts: "No products supplied",
    cadastralNumbers: "Cadastral numbers",
    overview: "Area overview",
    layers: "Layers",
    treatments: "Planned treatments",
    sourceReviewNotice:
      "Source-attributed records may be shown without independent verification. This is not a bee safety assessment.",
    syntheticDataNotice:
      "DEMO DATA: all fields, plans and statuses are fictional. Not Saturn evidence or a safety assessment.",
    noTreatments:
      "No treatment polygons are available yet. Missing records do not mean no treatments.",
    mapLoadError: "Unable to load treatment layer.",
    loading: "Loading map…",
    refresh: "Refresh map",
    polygonCount: "Polygons",
    mapLimitNotice:
      "Up to 200 polygons are shown for the visible area. Zoom in to narrow the results.",
    mapSource: "Basemap: OpenStreetMap",
    inspectedPoint: "Selected location",
    selectPoint: "Select a point on the map to inspect its weather forecast.",
    weather: "Weather at selected location",
    weatherSource: "Forecast model, not a pesticide safety assessment.",
    weatherLoading: "Loading forecast…",
    weatherError: "Weather data is temporarily unavailable.",
    retry: "Retry",
    temperature: "Temperature",
    humidity: "Humidity",
    wind: "Wind",
    precipitation: "Precipitation",
    forecastTime: "Forecast time",
    retrievedAt: "Retrieved",
    source: "Source",
    noPoint: "No point selected",
    radius: "View radius",
    radiusVisualizationOnly:
      "The circle is visual only: radius-filtered Saturn retrieval is not yet connected.",
    selected: "Selected",
    unverified: "Unverified. Not a safety assessment.",
    verified: "Operator reviewed. Not a safety assessment.",
    cadastral: "Cadastre",
    period: "Period",
    substance: "Product",
    unknown: "Not supplied",
    original: "View original source",
    language: "Language",
    pilot: "Pilot region",
  },
} as const;
export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof messages.ru;
export const translate = (locale: Locale, key: MessageKey): string =>
  messages[locale][key];
export const formatTime = (locale: Locale, iso: string): string =>
  new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso)) + " UTC";
