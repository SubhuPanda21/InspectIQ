import { Route, Routes } from 'react-router-dom';
import { SmoothScroll } from './motion';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Inspect from './pages/Inspect.jsx';
import Inspection from './pages/Inspection.jsx';
import Inspections from './pages/Inspections.jsx';
import Benchmark from './pages/Benchmark.jsx';
import { Privacy, Terms, NotFound } from './pages/Legal.jsx';

export default function App() {
  return (
    <SmoothScroll>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/inspect" element={<Inspect />} />
          <Route path="/i/:id" element={<Inspection />} />
          <Route path="/inspections" element={<Inspections />} />
          <Route path="/accuracy" element={<Benchmark />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </SmoothScroll>
  );
}
