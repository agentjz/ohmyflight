(function () {
  const runtime = window.TrainingToolApp || (window.TrainingToolApp = {} as TrainingToolAppRuntime);

  runtime.state = {
    sourceFileName: "",
    workbook: null,
    analysis: null,
    workbookHealth: null,
    busy: false,
    pendingExport: null,
    pendingExportName: "",
    pendingExportLabel: "",
    workbenchResult: null,
    workbenchView: null,
    workbenchSelection: null,
    workbenchSelectedPersonKeys: [],
    simulationRecords: [],
    scheduledDistribution: null,
    annualTrainingStats: null,
    annualTrainingStatsView: null,
    crmAnnualResult: null,
    trainingCalendarResult: null,
    trainingCalendarMonthKey: "",
    updateSelectedProjects: []
  };
})();
