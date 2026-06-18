import { useEffect, useMemo, useState } from "react";
import Select from "react-select";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://clinical-reasoning-trainer.onrender.com";
const RANDOM_CONCERN = "Random / Mixed";

const formatElapsed = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

export default function App() {
  const [cases, setCases] = useState([]);
  const [options, setOptions] = useState({
    differential_options: [],
    exam_options: [],
    lab_options: [],
    imaging_options: [],
    chief_concerns: []
  });
  const [selectedConcern, setSelectedConcern] = useState(RANDOM_CONCERN);
  const [caseId, setCaseId] = useState("");
  const [caseDetail, setCaseDetail] = useState({});
  const [revealData, setRevealData] = useState({
    exam_results: {},
    lab_results: {},
    imaging_results: {}
  });
  const [status, setStatus] = useState({ loading: true, error: "" });

  const [differentials, setDifferentials] = useState(["", "", ""]);
  const [examSelection, setExamSelection] = useState([]);
  const [labSelection, setLabSelection] = useState([]);
  const [imagingSelection, setImagingSelection] = useState("");
  const [finalDx, setFinalDx] = useState("");

  const [diffSubmitted, setDiffSubmitted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [labsSubmitted, setLabsSubmitted] = useState(false);
  const [imagingSubmitted, setImagingSubmitted] = useState(false);
  const [finalSubmitted, setFinalSubmitted] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState("");

  const [caseStart, setCaseStart] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;
  const selectStyles = useMemo(
    () => ({
      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      menu: (base) => ({ ...base, zIndex: 9999 })
    }),
    []
  );

  const examOptions = useMemo(
    () => options.exam_options.map((item) => ({ value: item, label: item })),
    [options.exam_options]
  );
  const labOptions = useMemo(
    () => options.lab_options.map((item) => ({ value: item, label: item })),
    [options.lab_options]
  );
  const imagingOptions = useMemo(
    () => options.imaging_options.map((item) => ({ value: item, label: item })),
    [options.imaging_options]
  );
  const differentialOptions = useMemo(
    () => options.differential_options.map((item) => ({ value: item, label: item })),
    [options.differential_options]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - caseStart) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [caseStart]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setStatus({ loading: true, error: "" });
        const [casesRes, optionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/cases`),
          fetch(`${API_BASE}/api/options`)
        ]);
        if (!casesRes.ok || !optionsRes.ok) {
          throw new Error("Failed to load remote data");
        }
        const casesData = await casesRes.json();
        const optionsData = await optionsRes.json();
        setCases(casesData);
        setOptions(optionsData);
        if (casesData.length > 0) {
          setCaseId(casesData[0].id);
        }
        setStatus({ loading: false, error: "" });
      } catch (error) {
        setStatus({ loading: false, error: "API not reachable. Start the backend to load cases." });
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!caseId) return;
    const fetchCase = async () => {
      try {
        const [detailRes, revealRes] = await Promise.all([
          fetch(`${API_BASE}/api/cases/${caseId}`),
          fetch(`${API_BASE}/api/cases/${caseId}/reveal`)
        ]);
        if (!detailRes.ok || !revealRes.ok) {
          throw new Error("Failed to load case detail");
        }
        const detailData = await detailRes.json();
        const revealPayload = await revealRes.json();
        setCaseDetail(detailData);
        setRevealData(revealPayload);
      } catch (error) {
        setStatus({ loading: false, error: "Unable to load case details." });
      }
    };

    fetchCase();
  }, [caseId]);

  const filteredCases = useMemo(() => {
    if (selectedConcern === RANDOM_CONCERN) {
      return cases;
    }
    return cases.filter((item) => item.chief_concern === selectedConcern);
  }, [cases, selectedConcern]);

  useEffect(() => {
    if (filteredCases.length === 0) return;
    const currentExists = filteredCases.some((item) => item.id === caseId);
    if (!currentExists) {
      const next = filteredCases[0];
      setCaseId(next.id);
    }
  }, [filteredCases, caseId]);

  const resetForCase = (nextId) => {
    setCaseId(Number(nextId));
    setDifferentials(["", "", ""]);
    setExamSelection([]);
    setLabSelection([]);
    setImagingSelection("");
    setFinalDx("");
    setDiffSubmitted(false);
    setExamSubmitted(false);
    setLabsSubmitted(false);
    setImagingSubmitted(false);
    setFinalSubmitted(false);
    setFinalFeedback("");
    setCaseStart(Date.now());
  };

  const completeness = useMemo(() => {
    const filled = differentials.filter((item) => item.trim()).length >= 3;
    const examDone = examSelection.length > 0;
    const labsDone = labSelection.length > 0;
    const imagingDone = imagingSelection.trim().length > 0;
    const finalDone = finalDx.trim().length > 0;
    return Math.round(
      ((filled ? 1 : 0) + (examDone ? 1 : 0) + (labsDone ? 1 : 0) + (imagingDone ? 1 : 0) + (finalDone ? 1 : 0)) /
        5 *
        100
    );
  }, [differentials, examSelection, labSelection, imagingSelection, finalDx]);

  const imagingExplanation = useMemo(() => {
    if (!imagingSelection) return null;
    if (revealData.imaging_results && revealData.imaging_results[imagingSelection]) {
      return {
        modality: imagingSelection,
        description: revealData.imaging_results[imagingSelection]
      };
    }
    return {
      modality: imagingSelection,
      description: "No acute findings are seen on this study."
    };
  }, [imagingSelection, revealData.imaging_results]);

  const handleDiffChange = (index, value) => {
    const updated = [...differentials];
    updated[index] = value;
    setDifferentials(updated);
  };

  const selectedExamResults = examSelection.map((item) => ({
    maneuver: item,
    result: revealData.exam_results?.[item] ?? "Normal exam for this finding."
  }));

  const selectedLabResults = labSelection.map((item) => ({
    lab: item,
    value: revealData.lab_results?.[item] ?? "Within normal limits."
  }));

  const handleFinalSubmit = async () => {
    setFinalSubmitted(true);
    try {
      const response = await fetch(`${API_BASE}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          differentials,
          exam_maneuvers: examSelection,
          labs: labSelection,
          imaging: imagingSelection,
          final_diagnosis: finalDx
        })
      });
      if (!response.ok) {
        throw new Error("Submit failed");
      }
      const payload = await response.json();
      setFinalFeedback(payload.full_explanation ?? payload.case_explanation ?? "");
    } catch (error) {
      setFinalFeedback(
        caseDetail.full_explanation ??
          caseDetail.case_explanation ??
          "Detailed feedback is unavailable right now."
      );
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Clinical Reasoning Trainer</p>
          <h1>Train the sequence: differential, exam, diagnostics, decision.</h1>
          <p className="subtitle">
            Pick a case, make your best call at each step, and see staged feedback to sharpen clinical
            reasoning.
          </p>
          <div className="hero-actions">
            <label className="select-field">
              <span>Select chief concern</span>
              <select
                value={selectedConcern}
                onChange={(event) => {
                  const nextConcern = event.target.value;
                  setSelectedConcern(nextConcern);
                  if (nextConcern === RANDOM_CONCERN && cases.length > 0) {
                    const randomCase = cases[Math.floor(Math.random() * cases.length)];
                    resetForCase(randomCase.id);
                  }
                }}
              >
                <option value={RANDOM_CONCERN}>{RANDOM_CONCERN}</option>
                {options.chief_concerns.map((concern) => (
                  <option key={concern} value={concern}>
                    {concern}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span>Choose case</span>
              <select value={caseId} onChange={(event) => resetForCase(event.target.value)}>
                {filteredCases.map((item) => (
                  <option key={item.id} value={item.id}>
                    Case {item.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="progress compact">
              <div className="progress-top">
                <span>Completion</span>
                <strong>{completeness}%</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${completeness}%` }} />
              </div>
            </div>
          </div>
          {status.error && <p className="muted status">{status.error}</p>}
        </div>
        <div className="hero-card">
          <div className="callout">
            <h3>Current case</h3>
            <p>{caseDetail.demographics}</p>
          </div>
          <div className="tags">
            {(caseDetail.symptoms ?? []).map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
          <div className="metrics">
            <div>
              <span>Elapsed</span>
              <strong>{formatElapsed(elapsedSeconds)}</strong>
            </div>
            <div>
              <span>Case flow</span>
              <strong>{finalSubmitted ? "Complete" : "In progress"}</strong>
            </div>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="card vignette">
          <div className="card-header">
            <h2>Clinical vignette</h2>
            <span className="pill">Case {caseDetail.id}</span>
          </div>
          <p className="muted">{caseDetail.demographics}</p>
          <p>{caseDetail.history}</p>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Differential diagnoses</h2>
            <span className="pill">Step 1</span>
          </div>
          <div className="stack">
            {differentials.map((value, index) => (
              <label key={`dx-${index}`} className="select-row">
                <span>#{index + 1}</span>
                <select value={value} onChange={(event) => handleDiffChange(index, event.target.value)}>
                  <option value="">Select diagnosis</option>
                  {options.differential_options.map((dx) => (
                    <option key={`${index}-${dx}`} value={dx}>
                      {dx}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => setDiffSubmitted(true)}
            disabled={differentials.some((item) => !item)}
          >
            Save differentials
          </button>
          {diffSubmitted && <p className="muted">Differentials saved.</p>}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Physical exam maneuvers</h2>
            <span className="pill">Step 2</span>
          </div>
          <label className="select-field">
            <span>Select maneuvers</span>
            <Select
              isMulti
              className="multi-select"
              classNamePrefix="crt"
              options={examOptions}
              value={examOptions.filter((option) => examSelection.includes(option.value))}
              menuPortalTarget={menuPortalTarget}
              styles={selectStyles}
              onChange={(selected) => {
                setExamSelection((selected ?? []).map((item) => item.value));
              }}
              placeholder="Choose maneuvers"
            />
          </label>
          <button className="primary" onClick={() => setExamSubmitted(true)} disabled={examSelection.length === 0}>
            Submit maneuvers
          </button>
          {examSubmitted && (
            <div className="reveal-box">
              <h3>Exam results</h3>
              {selectedExamResults.length === 0 ? (
                <p className="muted">No targeted findings from the selected maneuvers.</p>
              ) : (
                <ul>
                  {selectedExamResults.map((item) => (
                    <li key={item.maneuver}>
                      <strong>{item.maneuver}:</strong> {item.result}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Labs</h2>
            <span className="pill">Step 3</span>
          </div>
          <label className="select-field">
            <span>Select labs</span>
            <Select
              isMulti
              className="multi-select"
              classNamePrefix="crt"
              options={labOptions}
              value={labOptions.filter((option) => labSelection.includes(option.value))}
              menuPortalTarget={menuPortalTarget}
              styles={selectStyles}
              onChange={(selected) => {
                setLabSelection((selected ?? []).map((item) => item.value));
              }}
              placeholder="Choose labs"
            />
          </label>
          <button className="primary" onClick={() => setLabsSubmitted(true)} disabled={labSelection.length === 0}>
            Submit labs
          </button>
          {labsSubmitted && (
            <div className="reveal-box">
              <h3>Lab results</h3>
              {selectedLabResults.length === 0 ? (
                <p className="muted">No disease-specific lab results for the selected tests.</p>
              ) : (
                <ul>
                  {selectedLabResults.map((item) => (
                    <li key={item.lab}>
                      <strong>{item.lab}:</strong> {item.value}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Imaging</h2>
            <span className="pill">Step 4</span>
          </div>
          <label className="select-field">
            <span>Select imaging (one)</span>
            <select value={imagingSelection} onChange={(event) => setImagingSelection(event.target.value)}>
              <option value="">Select imaging</option>
              {imagingOptions.map((study) => (
                <option key={study.value} value={study.value}>
                  {study.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={() => setImagingSubmitted(true)} disabled={!imagingSelection}>
            Submit imaging
          </button>
          {imagingSubmitted && imagingExplanation && (
            <div className="reveal-box">
              <h3>Imaging findings</h3>
              <p>
                <strong>{imagingExplanation.modality}:</strong> {imagingExplanation.description}
              </p>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Final diagnosis</h2>
            <span className="pill">Step 5</span>
          </div>
          <label className="select-field">
            <span>Select final diagnosis</span>
            <select value={finalDx} onChange={(event) => setFinalDx(event.target.value)}>
              <option value="">Select diagnosis</option>
              {differentialOptions.map((dx) => (
                <option key={dx.value} value={dx.value}>
                  {dx.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={handleFinalSubmit} disabled={!finalDx}>
            Submit final diagnosis
          </button>
          {finalSubmitted && (
            <div className="reveal-box">
              <h3>Case analysis</h3>
              <p>{finalFeedback || "Detailed feedback will appear here."}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>Deliberate practice with staged feedback and clear decision points.</p>
      </footer>
    </div>
  );
}
