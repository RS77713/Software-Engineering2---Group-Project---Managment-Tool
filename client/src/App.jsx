import { BugDraftProvider } from './components/BugDrafts.jsx'
import BugCreatePage from './pages/BugCreatePage.jsx'
import BugsListPage from './pages/BugsListPage.jsx'
import BugDetailPage from './pages/BugDetailPage.jsx'
import { Route, Routes } from 'react-router-dom'
import './App.css'
import NavBar from './components/NavBar.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import TestCaseDetailPage from './pages/TestCaseDetailPage.jsx'
import TestCaseFormPage from './pages/TestCaseFormPage.jsx'
import TestCaseImportPage from './pages/TestCaseImportPage.jsx'
import TestCasesListPage from './pages/TestCasesListPage.jsx'
import TestRunDetailPage from './pages/TestRunDetailPage.jsx'
import TestRunsListPage from './pages/TestRunsListPage.jsx'
import TestSuiteDetailPage from './pages/TestSuiteDetailPage.jsx'
import TestSuiteFormPage from './pages/TestSuiteFormPage.jsx'
import TestSuitesListPage from './pages/TestSuitesListPage.jsx'

function App() {
  return (
    <BugDraftProvider>
      <NavBar />
      <Routes>
        <Route path="/bugs" element={<BugsListPage />} />
        <Route path="/bugs/new/:runId/:resultId" element={<BugCreatePage />} />
        <Route path="/bugs/:id" element={<BugDetailPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/test-cases" element={<TestCasesListPage />} />
        <Route path="/test-cases/new" element={<TestCaseFormPage mode="create" />} />
        <Route path="/test-cases/import" element={<TestCaseImportPage />} />
        <Route path="/test-cases/:id/edit" element={<TestCaseFormPage mode="edit" />} />
        <Route path="/test-cases/:id" element={<TestCaseDetailPage />} />
        <Route path="/test-suites" element={<TestSuitesListPage />} />
        <Route path="/test-suites/new" element={<TestSuiteFormPage />} />
        <Route path="/test-suites/:id" element={<TestSuiteDetailPage />} />
        <Route path="/test-runs" element={<TestRunsListPage />} />
        <Route path="/test-runs/:id" element={<TestRunDetailPage />} />
      </Routes>
    </BugDraftProvider>
  )
}

export default App
