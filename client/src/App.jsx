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
    <>
      <NavBar />
      <Routes>
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
    </>
  )
}

export default App
