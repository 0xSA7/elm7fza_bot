// ═══════════════ AppContext.gs — جذر التركيب (كامل — V30) ═══════════════
const AppContext = {
  _cache: {},

  props()   { return this._cache.props   || (this._cache.props   = PropertiesService.getScriptProperties()); },
  secrets() {
    return this._cache.secrets || (this._cache.secrets = {
      token:  this.props().getProperty('BOT_TOKEN'),
      apiKey: this.props().getProperty('GEMINI_API_KEY'),
      chatId: this.props().getProperty('MY_CHAT_ID'),
      secret: this.props().getProperty('WEBHOOK_SECRET')
    });
  },
  sheetUrl() { return this._cache.url || (this._cache.url = SpreadsheetApp.getActiveSpreadsheet().getUrl()); },

  logRepo()      { return this._cache.logRepo  || (this._cache.logRepo  = new LogRepository()); },
  txRepo()       { return this._cache.txRepo   || (this._cache.txRepo   = new TransactionRepository()); },
  categoryRepo() { return this._cache.cats     || (this._cache.cats     = new CategoryRepository()); },
  budgetRepo()   { return this._cache.budgets  || (this._cache.budgets  = new BudgetRepository()); },
  runwayRepo()  { return this._cache.runway || (this._cache.runway = new RunwayRepository()); },
  promptRepo()   { return this._cache.prompts  || (this._cache.prompts  = new PromptRepository()); },

  telegram() { return this._cache.tg || (this._cache.tg = new TelegramClient(this.secrets().token, this.logRepo())); },
  gemini()   { return this._cache.ai || (this._cache.ai = new GeminiClient(this.secrets().apiKey, this.logRepo())); },

  lang()     { return this._cache.lang || (this._cache.lang = new LanguageService(this.props())); },
  backup()   {
    if (!this._cache.backup) {
      const b = new BackupService(this.txRepo(), this.props());
      this._cache.backup = b;
      this.logRepo().attachBackup(b);
    }
    return this._cache.backup;
  },
  dashboard() { return this._cache.dash || (this._cache.dash = new DashboardService(this.categoryRepo(), this.txRepo())); },
  brain()     { return this._cache.brain || (this._cache.brain = new IntentRouter(this.lang(), this.finance())); },

  finance() {
    return this._cache.fin ||
        (this._cache.fin = new FinanceService(this.txRepo(), this.budgetRepo(), this.lang(), this.runwayRepo()));
  },
  ai()      { return this._cache.int || (this._cache.int = new IntelligenceService(
                this.gemini(), this.promptRepo(), this.categoryRepo(), this.telegram(),
                this.finance(), this.lang())); },

  notifier() { return this._cache.notif || (this._cache.notif = new VersionNotifier(this.props(), this.telegram(), this.secrets().chatId)); },
  deduper()  { return this._cache.dedup || (this._cache.dedup = new UpdateDeduper(this.props())); },
  buttons()  { return this._cache.btns  || (this._cache.btns  = new ButtonRouter()); },
  commands() {
    if (!this._cache.cmds) {
      const reg = new CommandRegistry();
      registerCommands(reg);
      this._cache.cmds = reg;
    }
    return this._cache.cmds;
  },
  retryQueue() {
    return this._cache.retry || (this._cache.retry = new RetryQueue(
      this.telegram(), this.secrets().chatId, this.logRepo(), this.lang()));
  },
  dispatcher() {
    return this._cache.disp || (this._cache.disp = new UpdateDispatcher({
      telegram: this.telegram(), finance: this.finance(), ai: this.ai(),
      prompts: this.promptRepo(), txRepo: this.txRepo(), log: this.logRepo(),
      props: this.props(), lang: this.lang(), backup: this.backup(),
      dashboard: this.dashboard(), sheetUrl: this.sheetUrl(),
      brain: this.brain(),
      buttons: this.buttons(), commands: this.commands(),
      deduper: this.deduper(), notifier: this.notifier(),
      chatId: this.secrets().chatId,
      runway: this.runwayRepo(),
    }));
  },
  polling() {
    return this._cache.poll || (this._cache.poll = new PollingEngine(
      this.props(), this.telegram(), this.dispatcher(), this.logRepo(),
      this.secrets().chatId, this.retryQueue()));
  }
};