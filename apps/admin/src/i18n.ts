export const messages = {
  ru: {
    viewportGuideTitle: "Как загружать данные — три шага",
    viewportGuideOne:
      "1. Откройте обычную карту пчеловода и выберите Ярцевский район. Карта переместится к нему.",
    viewportGuideTwo:
      "2. Приблизьте нужные поля и задайте период обновлений карты (это не даты фактических обработок).",
    viewportGuideThree:
      "3. Нажмите «Загрузить страницу». Данные сохраняются на сервере. Каждое следующее нажатие продолжит загрузку после паузы источника.",
    viewportGuideOpen: "Перейти к карте пчеловода",
    viewportGuideLimits:
      "Пилот: только Ярцевский район. Получаем индекс центров полей; контуры и препараты пока загружаются отдельно. Запрос не доказывает полноту района.",
    viewportAdvanced:
      "Дополнительно: ручная диагностика источника и технические координаты",

    viewportTitle: "Индекс «Сатурна» по выбранному квадрату",
    viewportDisclaimer:
      "Пилот: только Ярцевский район. По нажатию загружается одна страница /query, не полигоны и не фактические обработки. Даты — UpdateMap; полнота истории района неизвестна.",
    viewportDistrict: "Район источника",
    viewportWest: "Запад (долгота)",
    viewportSouth: "Юг (широта)",
    viewportEast: "Восток (долгота)",
    viewportNorth: "Север (широта)",
    viewportFrom: "UpdateMap с",
    viewportTo: "UpdateMap по",
    viewportCheck: "Проверить сохранённое",
    viewportFetch: "Загрузить следующую страницу",
    viewportDisabled:
      "Реальные запросы выключены. Настройте SATURN_VIEWPORT_LIVE_ENABLED=true на backend после проверки условий доступа.",
    viewportEmpty: "Для этого квадрата ещё не загружено страниц.",
    viewportPages: "Страниц",
    viewportEntries: "Записей индекса",
    viewportNext: "Следующая страница",
    viewportState: "Статус индекса",

    help: "Помощь",
    mapAnalysis: "Карта и анализ",
    analysisSummary: "Краткая статистика",
    analysisScope:
      "Только записи, полученные для текущей предварительной карты. Это не полный охват территории и не статистика выполненных обработок.",
    analysisVisible: "Записей на карте",
    analysisVerified: "Проверены оператором",
    analysisUnreviewed: "Без подтверждённой проверки",
    analysisEmpty:
      "В предварительном слое пока нет записей. Отсутствие данных не означает отсутствия обработок.",
    analysisFuture:
      "Исторические сравнения, тренды и прогнозы появятся после проверки полноты источников. Этот блок не оценивает риск для пчёл.",
    helpLoading: "Загружаем руководство администратора…",
    helpLoadError:
      "Не удалось загрузить руководство. Проверьте подключение и повторите попытку.",
    helpRetry: "Повторить загрузку",
    backToImport: "Открыть загрузку данных",
    fieldDetails: "Информация об участке",
    closeFieldDetails: "Закрыть сведения об участке",
    chooseField: "Выберите участок на карте для просмотра подробностей.",
    cadastralNumbers: "Кадастровые номера",
    products: "Препараты",
    noProducts: "Препараты не указаны",
    crop: "Культура",
    hazardClass: "Класс опасности для пчёл (по источнику)",
    unverified: "Не проверено оператором",
    verifiedField: "Проверено оператором",
    source: "Источник",
    retrievedAt: "Получено",
    fieldSafetyCaveat:
      "Статус записи не является оценкой безопасности обработок.",
    helpFor: "Справка: {field}",
    developmentOnly: "На период разработки",
    manualImportReplacement:
      "Ручная загрузка отдельных страниц оставлена для диагностики. Её заменит выбор района и обновление общего районного кэша с TTL 24 часа. До подтверждения фильтров Сатурн районная загрузка отключена.",
    plannedFeature: "В разработке",
    helpLoadMore:
      "Один запрос получает только одну страницу списка Сатурн и сохраняет доступные записи. Страница не является районом и не подтверждает полное покрытие территории.",
    helpNextBatch:
      "Номер следующей страницы в запросе к источнику. Это технический курсор, а не номер района или количество оставшихся обработок.",
    helpLoadedCount:
      "Количество записей, полученных в последнем ответе источника. Не обязательно равно числу уникальных полей с геометрией.",
    helpNewCount:
      "Количество кандидатов, сохранённых при последнем запросе. Показатель не подтверждает, что все обработки района загружены.",
    helpDistrictCache:
      "Общий кэш планов обработок по административным районам. Записи считаются актуальными 24 часа только после успешной полной загрузки всех страниц района.",
    helpRefreshDistrict:
      "Планируемая кнопка принудительного обновления выбранного района. Она будет обходить TTL, но не ограничение частоты запросов Сатурн. Пока заблокирована из-за неподтверждённого API-фильтра района.",
    helpDistrictId:
      "Внутренний идентификатор района у поставщика данных. Он не обязательно совпадает с официальными административными и кадастровыми кодами.",
    helpDistrictCoverage:
      "Состояние полноты загрузки района. Частичная или неудачная попытка не обновляет время последней успешно завершённой загрузки.",
    helpRegionProgress:
      "Количество страниц источника, сохранённых для текущей попытки. Это ещё не гарантия полного покрытия района.",
    helpDistrictLastCompleted:
      "Время последней успешной загрузки всех необходимых страниц района. Отсутствие даты означает, что полная загрузка не подтверждена.",
    helpRevision:
      "Версия сохранённой конфигурации. Используется, чтобы два оператора не перезаписали изменения друг друга незаметно.",
    helpEndpoint:
      "HTTPS-адрес API источника, с которого backend получает данные. Изменяйте только после проверки реального контракта и прав доступа.",
    helpMethod:
      "HTTP-метод запроса к источнику: GET или POST. Должен соответствовать фактическому API-контракту.",
    helpRegionParameter:
      "Имя ключа, через который API принимает код региона (например, subject). Это не значение кода региона.",
    helpRegionContainer:
      "Необязательное имя вложенного объекта, содержащего фильтр региона. Для некоторых API фильтр передаётся внутри отдельного объекта.",
    helpRegionCode:
      "Внутренний код региона в API поставщика; он может отличаться от официального кода субъекта РФ. Проверьте его по данным источника.",
    helpParameters:
      "Дополнительные параметры HTTP-запроса в виде корректного JSON-объекта. Не добавляйте сюда токены, пароли или неподтверждённые фильтры.",
    helpEvidence:
      "Кратко укажите, какие сведения первоисточника вы проверили и почему решение обосновано. Требуется минимум 20 символов.",
    syntheticDataNotice:
      "ДЕМОДАННЫЕ: все записи, поля и статусы проверки вымышлены. Не использовать как сведения Сатурн или оценку опасности.",
    title: "Управление данными",
    subtitle: "Локальная административная панель",
    sources: "Источники",
    import: "Загрузка данных",
    configuration: "Конфигурация",
    review: "Проверка записей",
    map: "Предварительная карта",
    loading: "Загрузка…",
    missing: "Нет данных",
    error: "Операция не выполнена. Проверьте журнал backend.",
    provider: "Поставщик данных об обработках",
    sourceName: "Название источника",
    endpoint: "HTTPS API endpoint",
    method: "HTTP метод",
    regionParameter: "Ключ фильтра региона",
    regionContainer: "Объект фильтра региона",
    regionCode: "Код региона поставщика",
    parameters: "Параметры запроса (JSON)",
    save: "Сохранить конфигурацию",
    saved: "Конфигурация сохранена. Загрузка данных не запускалась.",
    editHint: "Изменение настроек не запускает обращение к внешнему сервису.",
    reload: "Обновить статус",
    loadMore: "Получить следующую страницу",
    loadHint:
      "Диагностическая загрузка получает одну страницу и не подтверждает полноту данных по району.",
    districtCache: "Районный кэш",
    districtTtl: "Срок актуальности: 24 часа после полного обновления района.",
    districtContractPending:
      "Обновление недоступно до проверки реальных параметров района и периода в API Сатурн.",
    refreshDistrict: "Обновить район сейчас",
    districtNoCoverage: "Покрытие районов пока не подтверждено.",
    districtCoverage: "Покрытие",
    districtId: "ID района источника",
    districtLastCompleted: "Последнее полное обновление",
    districtUnavailable: "Статус районного кэша недоступен.",
    fresh: "Актуально",
    stale: "Устарело",
    regionScan: "Полный обход региона",
    startRegionScan: "Запустить обход",
    pauseRegionScan: "Приостановить",
    resumeRegionScan: "Продолжить обход",
    regionNotStarted: "Обход ещё не запускался",
    regionRunning: "Выполняется",
    regionPaused: "Приостановлен",
    regionCompleted: "Завершён",
    regionProgress: "Обработано порций",
    regionRecords: "Прочитано записей",
    regionTotal: "Всего по данным источника",
    regionCodeLabel: "Код региона",
    regionIncomplete:
      "Прогресс относится только к настроенному фильтру источника; полное покрытие не гарантируется при изменениях списка во время обхода.",
    loadedCount: "Получено записей",
    newCount: "Добавлено кандидатов",
    nextBatch: "Следующая страница",
    pending: "Ожидают проверки",
    verified: "Проверены",
    missingGeometry: "Без геометрии",
    lastRun: "Последняя загрузка",
    started: "Выполняется",
    succeeded: "Успешно",
    failed: "Ошибка",
    partial: "Частично",
    never: "Не выполнялась",
    showPending: "Показать кандидатов",
    reviewer: "Имя проверяющего",
    evidence: "Основание решения (не менее 20 символов)",
    approve: "Проверить и опубликовать",
    reject: "Отклонить",
    original: "Первоисточник",
    period: "Период",
    unknown: "Не указан",
    geometry: "Геометрия",
    yes: "Есть",
    no: "Нет",
    reviewHint:
      "Публикуйте только записи, сверенные с первоисточником. Непроверенные поля не отображаются на публичной карте.",
    previewHint:
      "Нажмите на контур участка, чтобы увидеть подробности справа. Пунктир — непроверенные записи; сплошная линия — опубликованные. Это не оценка опасности для пчёл.",
    language: "Язык",
    localOnly:
      "Только локальный доступ. Не публиковать без серверной аутентификации.",
    sourceStatus: "Состояние источника",
    sourceConfigured: "Настроен",
    sourceMissing: "Не настроен",
    emptyCatalog: "Реестр источников пуст",
    terms: "Условия использования",
    reviewedTerms: "Проверены",
    unreviewedTerms: "Не подтверждены",
    revision: "Ревизия",
  },
  en: {
    viewportGuideTitle: "How to load data — three steps",
    viewportGuideOne:
      "1. Open the beekeeper map and choose Yartsevo District. The map will move to it.",
    viewportGuideTwo:
      "2. Zoom to the fields and choose a map-update period (not actual treatment dates).",
    viewportGuideThree:
      "3. Select Load page. Entries are saved on the server; each later click resumes after the source cooldown.",
    viewportGuideOpen: "Open beekeeper map",
    viewportGuideLimits:
      "Pilot: Yartsevo District only. The result is an index of field centers, not yet polygons or product details; it cannot establish complete district coverage.",
    viewportAdvanced:
      "Advanced: manual source diagnostics and technical coordinates",

    viewportTitle: "Saturn map index for a bounded viewport",
    viewportDisclaimer:
      "Pilot: Yartsevo district only. Each click fetches one /query page, not polygons or confirmed treatments. Dates filter UpdateMap; district history completeness is unknown.",
    viewportDistrict: "Provider district",
    viewportWest: "West (longitude)",
    viewportSouth: "South (latitude)",
    viewportEast: "East (longitude)",
    viewportNorth: "North (latitude)",
    viewportFrom: "UpdateMap from",
    viewportTo: "UpdateMap to",
    viewportCheck: "Check saved progress",
    viewportFetch: "Fetch next page",
    viewportDisabled:
      "Live requests are disabled. Set SATURN_VIEWPORT_LIVE_ENABLED=true on the backend after reviewing access terms.",
    viewportEmpty: "No pages are stored for this viewport yet.",
    viewportPages: "Pages",
    viewportEntries: "Index entries",
    viewportNext: "Next page",
    viewportState: "Index status",

    help: "Help",
    mapAnalysis: "Map and analysis",
    analysisSummary: "Quick summary",
    analysisScope:
      "Only records returned for the current preview map. This is not complete territorial coverage or a count of actual spray events.",
    analysisVisible: "Mapped records",
    analysisVerified: "Operator reviewed",
    analysisUnreviewed: "Not independently reviewed",
    analysisEmpty:
      "No records are in the preview layer. Missing data does not mean no treatments exist.",
    analysisFuture:
      "Historical comparisons, trends and forecasts will follow verified source coverage. This panel does not assess bee safety.",
    helpLoading: "Loading the administrator guide…",
    helpLoadError:
      "The guide could not be loaded. Check your connection and try again.",
    helpRetry: "Retry loading",
    backToImport: "Open data collection",
    fieldDetails: "Field details",
    closeFieldDetails: "Close field details",
    chooseField: "Select a field on the map to inspect its details.",
    cadastralNumbers: "Cadastral numbers",
    products: "Products",
    noProducts: "No products supplied",
    crop: "Crop",
    hazardClass: "Bee hazard class (source reported)",
    unverified: "Not operator reviewed",
    verifiedField: "Operator reviewed",
    source: "Source",
    retrievedAt: "Retrieved",
    fieldSafetyCaveat: "Review status is not a pesticide-safety assessment.",
    helpFor: "Help: {field}",
    developmentOnly: "Development-only",
    manualImportReplacement:
      "Manual single-page collection remains for diagnostics. It will be replaced by district selection and shared district-cache refresh with a 24-hour TTL. District collection stays disabled until Saturn filters are verified.",
    plannedFeature: "In development",
    helpLoadMore:
      "One request retrieves just one page of the Saturn listing and stores available records. A page is not a district and does not prove complete geographic coverage.",
    helpNextBatch:
      "The next upstream listing page number. This is a technical cursor, not a district identifier or the number of remaining treatments.",
    helpLoadedCount:
      "Number of records returned by the source in the last request. This may differ from the number of unique fields with geometry.",
    helpNewCount:
      "Number of candidates stored by the latest request. It does not confirm that all treatments in a district have been loaded.",
    helpDistrictCache:
      "A shared cache of treatment plans by administrative district. Coverage stays fresh for 24 hours only after every required district page completes successfully.",
    helpRefreshDistrict:
      "A planned forced refresh for a selected district. It will bypass TTL but not Saturn request pacing. Disabled until the actual upstream district filter is verified.",
    helpDistrictId:
      "The provider's internal district identifier. It may differ from official administrative and cadastral identifiers.",
    helpDistrictCoverage:
      "District collection completeness. Partial or failed attempts do not advance the last successful completion timestamp.",
    helpRegionProgress:
      "Number of upstream pages committed during the current attempt. It is not proof of complete district coverage.",
    helpDistrictLastCompleted:
      "When every required page of a district was last retrieved successfully. No date means that complete retrieval has not been established.",
    helpRevision:
      "Version of the saved configuration, used to avoid silently overwriting concurrent operator changes.",
    helpEndpoint:
      "HTTPS API address the backend uses to fetch source records. Change it only after verifying the real contract and access terms.",
    helpMethod:
      "HTTP method used to access the provider: GET or POST. It must match the observed API contract.",
    helpRegionParameter:
      "Name of the API parameter carrying the region code (for example, subject), not the code value itself.",
    helpRegionContainer:
      "Optional name of a nested request object containing the region filter. Some APIs require filters inside a container object.",
    helpRegionCode:
      "Provider-specific region identifier, which can differ from an official administrative code. Verify it against source data.",
    helpParameters:
      "Additional HTTP request parameters as a valid JSON object. Do not enter credentials or unverified filters here.",
    helpEvidence:
      "Briefly explain which original-source facts were checked and why the decision is justified. At least 20 characters are required.",
    syntheticDataNotice:
      "DEMO DATA: all records, fields and review statuses are fictional. Not Saturn evidence or a safety assessment.",
    title: "Data administration",
    subtitle: "Local operator workspace",
    sources: "Sources",
    import: "Data collection",
    configuration: "Configuration",
    review: "Record review",
    map: "Preview map",
    loading: "Loading…",
    missing: "No data",
    error: "Operation failed. Check backend diagnostics.",
    provider: "Treatment data provider",
    sourceName: "Source name",
    endpoint: "HTTPS API endpoint",
    method: "HTTP method",
    regionParameter: "Region parameter key",
    regionContainer: "Region filter container",
    regionCode: "Provider region code",
    parameters: "Request parameters (JSON)",
    save: "Save configuration",
    saved: "Configuration saved. No data fetch was started.",
    editHint: "Editing settings does not trigger external requests.",
    reload: "Refresh status",
    loadMore: "Fetch next page",
    loadHint:
      "Diagnostic collection fetches one page and does not establish complete district coverage.",
    districtCache: "District cache",
    districtTtl: "Freshness TTL: 24 hours after a complete district refresh.",
    districtContractPending:
      "Refresh is unavailable until the real Saturn district and date filters are verified.",
    refreshDistrict: "Refresh district now",
    districtNoCoverage: "No district coverage has been verified yet.",
    districtCoverage: "Coverage",
    districtId: "Provider district ID",
    districtLastCompleted: "Last complete refresh",
    districtUnavailable: "District cache status is unavailable.",
    fresh: "Fresh",
    stale: "Stale",
    regionScan: "Full region collection",
    startRegionScan: "Start collection",
    pauseRegionScan: "Pause",
    resumeRegionScan: "Resume collection",
    regionNotStarted: "No region scan has started",
    regionRunning: "Running",
    regionPaused: "Paused",
    regionCompleted: "Completed",
    regionProgress: "Pages processed",
    regionRecords: "Records received",
    regionTotal: "Total reported by provider",
    regionCodeLabel: "Region code",
    regionIncomplete:
      "Progress covers the configured provider filter only; concurrent changes to provider listings may affect coverage.",
    loadedCount: "Received records",
    newCount: "Stored candidates",
    nextBatch: "Next page",
    pending: "Pending review",
    verified: "Verified",
    missingGeometry: "Missing geometry",
    lastRun: "Last collection",
    started: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
    partial: "Partial",
    never: "Never run",
    showPending: "Show candidates",
    reviewer: "Reviewer name",
    evidence: "Evidence note (at least 20 characters)",
    approve: "Verify and publish",
    reject: "Reject",
    original: "Original source",
    period: "Period",
    unknown: "Not supplied",
    geometry: "Geometry",
    yes: "Present",
    no: "Missing",
    reviewHint:
      "Publish only records checked against source evidence. Unverified fields remain hidden from the public map.",
    previewHint:
      "Select a field outline to see details on the right. Dashed = pending; solid = published. Not a pesticide safety assessment.",
    language: "Language",
    localOnly:
      "Local access only. Do not expose without server-side authentication.",
    sourceStatus: "Source status",
    sourceConfigured: "Configured",
    sourceMissing: "Not configured",
    emptyCatalog: "Source catalog is empty",
    terms: "Terms review",
    reviewedTerms: "Reviewed",
    unreviewedTerms: "Unconfirmed",
    revision: "Revision",
  },
} as const;
export type Locale = keyof typeof messages;
export type Key = keyof typeof messages.ru;
export const t = (locale: Locale, key: Key): string => messages[locale][key];
