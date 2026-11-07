// Feature IDs: SOURCES.DOCUMENT_HISTORY
/** Localized copy for the read-only Saturn viewport cache journal. */
export const cacheHistoryMessages = {
  ru: {
    cacheHistoryShowFields: "Показать сохранённые поля",
    cacheHistoryFieldsError: "Не удалось прочитать поля из БД.",
    cacheHistoryFieldsNote:
      "Первые 100 сохранённых центров; это не полигоны обработок.",
    cacheHistoryFieldsEmpty: "В этой загрузке нет записей полей.",
    cacheHistoryField: "Поле ID",
    cacheHistoryPlan: "План ID",
    requestLogTitle: "Журнал запросов к Сатурну",
    requestLogRefresh: "Обновить журнал запросов",
    requestLogExplain:
      "Попытки Web и Admin, включая ошибки и лимиты. Записывается в PostgreSQL, без координат пасек и ответов источника. Не включает старый диагностический импорт.",
    requestLogError: "Не удалось получить журнал запросов.",
    requestLogEmpty: "Запросов к новому загрузчику пока не было.",
    requestLogDirectory: "Справочник районов",
    requestLogPage: "Индекс полей, район",
    requestLogBatch: "Порция",
    requestLogInitiator: "Запущено",
    requestLogWeb: "Карта",
    requestLogAdmin: "Admin",
    requestLogRecords: "Получено записей",
    requestLogEndpoint: "Адрес запроса",
    requestLogCode: "Код ошибки",
    requestLogStatus_started: "начат, итог неизвестен",
    requestLogStatus_succeeded: "сохранено",
    requestLogStatus_failed: "ошибка",
    requestLogStatus_throttled: "лимит частоты",
    requestLogStatus_cache_hit: "прочитано из кэша",
    cacheHistoryTitle: "Что уже сохранено в кэше PostgreSQL",
    legacyCollectorTitle: "Отдельная диагностика старого API",
    legacyCollectorExplain:
      "Кнопка ниже вызывает /planapplybees, а не lazy-загрузку /query с карты. Для истории клиентских загрузок используйте журнал выше.",
    cacheHistoryExplain:
      "Общий журнал для загрузок из карты пчеловода и Admin. Каждый запрос привязан к точному квадрату и периоду. В таблице — индекс центров полей, НЕ полигоны обработок. Неудачные обращения и инициатор отображаются в отдельном журнале запросов ниже.",
    cacheHistoryRefresh: "Обновить журнал",
    cacheHistoryEmpty:
      "Сохранённых запросов пока нет. Загрузите до 10 записей на обычной карте и обновите журнал.",
    cacheHistoryError:
      "Не удалось прочитать журнал кэша из базы. Проверьте API и миграцию 014.",
    cacheHistoryDistrict: "Код района",
    cacheHistorySaved: "Записей индекса в БД",
    cacheHistoryPages: "Получено порций (до 10 записей)",
    cacheHistoryUpdated: "Последнее сохранение",
    cacheHistoryComplete: "все порции этого квадрата сохранены",
    cacheHistoryPartial: "загрузка ещё не завершена",
    cacheHistoryRevision:
      "Конфигурация источника изменилась; это архив прежней версии.",
    cacheHistoryDetails: "Показать точные границы и последние сохранения",
    cacheHistoryBounds: "Координаты (запад, юг, восток, север)",
    cacheHistoryKey: "Ключ запроса",
    cacheHistoryBatch: "Порция",
    cacheHistoryLastFive:
      "Показаны не более пяти последних порций каждого запроса.",
    viewportPageExplanation:
      "«Страница» — порция ответа /query (до 10 полей), а НЕ участок карты. Повторная загрузка продолжает сохранённую последовательность для тех же координат и дат. Полигоны здесь не загружаются.",
  },
  en: {
    cacheHistoryShowFields: "Show stored fields",
    cacheHistoryFieldsError: "Failed to read field centers from the database.",
    cacheHistoryFieldsNote:
      "First 100 saved centers; these are not treatment polygons.",
    cacheHistoryFieldsEmpty: "No field entries in this saved request.",
    cacheHistoryField: "Field ID",
    cacheHistoryPlan: "Plan ID",
    requestLogTitle: "Saturn request log",
    requestLogRefresh: "Refresh request log",
    requestLogExplain:
      "Web/Admin attempts, including failures and throttling. Persisted in PostgreSQL without private apiary positions or provider bodies. Legacy diagnostic import is separate.",
    requestLogError: "Cannot load source request log.",
    requestLogEmpty: "No attempts from the new loader yet.",
    requestLogDirectory: "District directory",
    requestLogPage: "Field index, district",
    requestLogBatch: "Batch",
    requestLogInitiator: "Initiated by",
    requestLogWeb: "Map",
    requestLogAdmin: "Admin",
    requestLogRecords: "Records received",
    requestLogEndpoint: "Source endpoint",
    requestLogCode: "Error code",
    requestLogStatus_started: "started, outcome unknown",
    requestLogStatus_succeeded: "stored",
    requestLogStatus_failed: "failed",
    requestLogStatus_throttled: "rate limited",
    requestLogStatus_cache_hit: "served from cache",
    cacheHistoryTitle: "Saved PostgreSQL map-index cache",
    legacyCollectorTitle: "Separate legacy API diagnostic",
    legacyCollectorExplain:
      "The action below uses /planapplybees, not the map's lazy /query loader. Use the history above to inspect saved viewport pages.",
    cacheHistoryExplain:
      "Shared read-only history of loads from the beekeeper map and Admin. Each request is keyed by exact bounds and dates. These are field-center summaries, NOT treatment polygons. Failed attempts and the initiating UI are shown in the separate request log below.",
    cacheHistoryRefresh: "Refresh history",
    cacheHistoryEmpty:
      "No saved viewports yet. Load up to 10 records from the map and refresh here.",
    cacheHistoryError:
      "Could not read cached history from PostgreSQL. Check the API and migration 014.",
    cacheHistoryDistrict: "District ID",
    cacheHistorySaved: "Index records stored",
    cacheHistoryPages: "Batches of up to 10 stored",
    cacheHistoryUpdated: "Last saved",
    cacheHistoryComplete: "all batches for this rectangle stored",
    cacheHistoryPartial: "not yet complete",
    cacheHistoryRevision:
      "Source configuration changed; this is an earlier revision.",
    cacheHistoryDetails: "Show precise bounds and recent saved batches",
    cacheHistoryBounds: "Bounds (west, south, east, north)",
    cacheHistoryKey: "Request key",
    cacheHistoryBatch: "Batch",
    cacheHistoryLastFive:
      "Only the last five batches for this request are displayed.",
    viewportPageExplanation:
      "A page is a batch of at most 10 field summaries from /query, NOT a part of the map. Repeated requests resume for the identical bounds and dates; no polygons are fetched.",
  },
} as const;
