import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Heart, Sparkles, CheckCircle2, User, Mail, Phone, Calendar, Briefcase, Building2, ArrowRight } from 'lucide-react';
import { parseApiResponse } from '../utils/toastHelper';

const API_BASE = import.meta.env.VITE_API_URL;

const COMMON_SKILLS = [
  { key: 'Medical / First Aid', label: 'Medical' },
  { key: 'Logistics & Supply', label: 'Logistics' },
  { key: 'Event Management', label: 'Event Mgmt' },
  { key: 'IT Support & Tech', label: 'IT / Tech' },
  { key: 'Teaching & Training', label: 'Teaching' },
  { key: 'Translation / Languages', label: 'Translation' },
  { key: 'Community Outreach', label: 'Outreach' },
  { key: 'Fundraising & Grant Writing', label: 'Fundraising' },
  { key: 'Communications & Media', label: 'Communications' },
  { key: 'Administration & Data', label: 'Admin / Data' }
];

const AVAILABILITY_OPTIONS = [
  'Part-Time (10-20 hrs/wk)',
  'Full-Time (30+ hrs/wk)',
  'Weekends Only',
  'Evenings',
  'On-Call / Emergency Deployment'
];

export default function VolunteerPublicApply() {
  const [searchParams] = useSearchParams();
  const preselectedOrgId = searchParams.get('orgId');

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(preselectedOrgId ? parseInt(preselectedOrgId, 10) : null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    skills: [],
    customSkill: '',
    availability: 'Part-Time (10-20 hrs/wk)'
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch(`${API_BASE}/volunteers/public-organizations`);
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
        if (!selectedOrgId && data.length > 0) {
          setSelectedOrgId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load organizations', err);
    }
  };

  const toggleSkill = (skill) => {
    setFormData(prev => {
      const exists = prev.skills.includes(skill);
      return {
        ...prev,
        skills: exists ? prev.skills.filter(s => s !== skill) : [...prev.skills, skill]
      };
    });
  };

  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    if (formData.customSkill.trim() && !formData.skills.includes(formData.customSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, prev.customSkill.trim()],
        customSkill: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrgId) {
      setError('Please select an organization.');
      return;
    }
    if (formData.skills.length === 0) {
      setError('Please select or add at least one skill.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        organizationId: selectedOrgId,
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        skills: formData.skills.join(', '),
        availability: formData.availability
      };

      const res = await fetch(`${API_BASE}/volunteers/public-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await parseApiResponse(res);
        throw new Error(errText || 'Application submission failed.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  return (
    <div className="min-h-screen bg-[rgb(249,250,251)] text-slate-900 selection:bg-[rgb(234,238,243)] selection:text-slate-900 relative overflow-hidden font-sans">
      <div className="absolute top-[-8%] left-[6%] h-[420px] w-[420px] rounded-full bg-[rgb(227,236,247)]/35 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-8%] right-[8%] h-[520px] w-[520px] rounded-full bg-[rgb(241,233,246)]/35 blur-3xl pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-3xl border border-[rgb(220,224,233)] bg-[rgb(252,253,255)] p-5 shadow-[0_20px_60px_rgba(148,163,184,0.12)] sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Orbit volunteer portal</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Volunteer application</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Apply with a shorter, friendlier form. No account needed — just tell us your skills and availability.</p>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-3xl border border-[rgb(216,219,233)] bg-[rgb(249,250,251)] px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-[rgb(148,163,184)] hover:bg-[rgb(241,245,249)]"
          >
            <span>Sign in</span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </Link>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
          <main className="space-y-8">
            {submitted ? (
              <section className="rounded-[2rem] border border-[rgb(216,219,233)] bg-[rgb(255,255,255)] p-8 shadow-[0_34px_100px_rgba(148,163,184,0.15)]">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[rgb(214,255,216)] text-4xl text-[rgb(16,185,129)] shadow-inner border border-[rgb(204,251,192)]">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="mt-8 text-center space-y-4">
                  <h2 className="text-3xl font-black text-slate-900">Application submitted</h2>
                  <p className="mx-auto max-w-xl text-sm text-slate-600">Thank you for applying to volunteer with <span className="font-semibold text-[rgb(37,99,235)]">{selectedOrg?.name || 'our team'}</span>. We&apos;ll review your submission and contact you soon.</p>
                </div>

                <div className="mt-8 rounded-[1.75rem] border border-[rgb(216,219,233)] bg-[rgb(249,250,251)] p-6 text-left text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">What happens next</p>
                  <ul className="mt-4 space-y-3 list-disc pl-5 text-slate-500">
                    <li>We review your skills and availability.</li>
                    <li>Organization managers confirm the best match.</li>
                    <li>You get notified with the next steps.</li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', phoneNumber: '', skills: [], customSkill: '', availability: 'Part-Time (10-20 hrs/wk)' });
                  }}
                  className="mt-6 w-full rounded-3xl border border-[rgb(216,219,233)] bg-[rgb(255,255,255)] px-5 py-4 text-sm font-bold text-slate-900 transition hover:bg-[rgb(247,247,249)]"
                >
                  Submit another application
                </button>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-[rgb(216,219,233)] bg-[rgb(255,255,255)] p-8 shadow-[0_34px_100px_rgba(148,163,184,0.15)]">
                <div className="mb-8 space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(226,232,240)] bg-[rgb(243,244,246)] px-4 py-2 text-xs uppercase tracking-[0.35em] text-[rgb(37,99,235)]">
                    <Heart className="w-4 h-4 text-[rgb(37,99,235)]" />
                    Join the mission
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ready to volunteer?</h2>
                    <p className="mt-2 text-sm text-slate-600">Fill out the short form below and let us know where you want to help.</p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-[1.75rem] border border-[rgb(254,205,211)] bg-[rgb(255,245,248)] p-4 text-sm text-[rgb(127,29,29)]">
                    <p className="font-semibold text-[rgb(127,29,29)]">Submission issue</p>
                    <p className="mt-2 text-[rgb(111,66,66)]">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">Organization *</label>
                      <select
                        value={selectedOrgId || ''}
                        onChange={e => setSelectedOrgId(parseInt(e.target.value, 10))}
                        className="mt-3 w-full rounded-3xl bg-[rgb(247,247,249)] border border-[rgb(216,219,233)] px-4 py-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[rgb(37,99,235)] focus:ring-1 focus:ring-[rgb(37,99,235)]/20"
                      >
                        {organizations.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedOrg?.description && (
                      <div className="rounded-3xl border border-[rgb(216,219,233)] bg-[rgb(255,255,255)] p-4 text-sm text-slate-700">
                        <p className="text-xs uppercase tracking-[0.35em] text-[rgb(37,99,235)]">About this organization</p>
                        <p className="mt-3 leading-6 text-slate-600">{selectedOrg.description}</p>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-900">
                        Full name *
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Jane Doe"
                          className="mt-3 w-full rounded-3xl bg-[rgb(247,247,249)] border border-[rgb(216,219,233)] px-4 py-4 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[rgb(37,99,235)] focus:ring-1 focus:ring-[rgb(37,99,235)]/20"
                        />
                      </label>

                      <label className="block text-sm font-semibold text-slate-900">
                        Email address *
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder="you@example.com"
                          className="mt-3 w-full rounded-3xl bg-[rgb(247,247,249)] border border-[rgb(216,219,233)] px-4 py-4 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[rgb(37,99,235)] focus:ring-1 focus:ring-[rgb(37,99,235)]/20"
                        />
                      </label>
                    </div>

                    <label className="block text-sm font-semibold text-slate-900">
                      Phone number
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="mt-3 w-full rounded-3xl bg-[rgb(247,247,249)] border border-[rgb(216,219,233)] px-4 py-4 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[rgb(37,99,235)] focus:ring-1 focus:ring-[rgb(37,99,235)]/20"
                      />
                    </label>
                  </div>

                  <fieldset className="rounded-[2rem] border border-[rgb(216,219,233)] bg-[rgb(249,250,251)] p-6">
                    <legend className="px-2 text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Skills & expertise *</legend>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {COMMON_SKILLS.map(skill => {
                        const isSelected = formData.skills.includes(skill.key);
                        return (
                          <button
                            key={skill.key}
                            type="button"
                            onClick={() => toggleSkill(skill.key)}
                            className={`w-full rounded-[1.75rem] border px-4 py-3 text-[0.78rem] font-semibold text-left uppercase transition ${isSelected ? 'border-[rgb(37,99,235)] bg-[rgb(225,232,255)] text-[rgb(15,23,42)] shadow-[0_8px_22px_rgba(37,99,235,0.16)]' : 'border-[rgb(216,219,233)] bg-[rgb(247,247,249)] text-slate-700 hover:border-[rgb(148,163,184)] hover:text-slate-900'}`}
                          >
                            {isSelected ? '✓ ' : ''}{skill.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        type="text"
                        value={formData.customSkill}
                        onChange={e => setFormData({ ...formData, customSkill: e.target.value })}
                        placeholder="Add a custom skill"
                        className="w-full rounded-3xl bg-[rgb(247,247,249)] border border-[rgb(216,219,233)] px-4 py-4 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[rgb(37,99,235)] focus:ring-1 focus:ring-[rgb(37,99,235)]/20"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSkill}
                        className="rounded-3xl bg-[rgb(37,99,235)] px-5 py-4 text-sm font-bold text-white transition hover:bg-[rgb(29,78,216)]"
                      >
                        Add skill
                      </button>
                    </div>

                    {formData.skills.length > 0 && (
                      <p className="mt-4 text-sm text-slate-500">Selected skills: <span className="inline-flex items-center rounded-full bg-[rgb(247,247,249)] px-3 py-1 font-semibold text-slate-900">{formData.skills.join(', ')}</span></p>
                    )}
                  </fieldset>

                  <label className="block text-sm font-semibold text-slate-900">
                    Availability
                    <select
                      value={formData.availability}
                      onChange={e => setFormData({ ...formData, availability: e.target.value })}
                      className="mt-3 w-full rounded-3xl bg-[rgb(247,247,249)] border border-[rgb(216,219,233)] px-4 py-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[rgb(37,99,235)] focus:ring-1 focus:ring-[rgb(37,99,235)]/20"
                    >
                      {AVAILABILITY_OPTIONS.map(opt => (
                        <option key={opt} value={opt} className="bg-[rgb(247,247,249)] text-slate-900">{opt}</option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 w-full rounded-3xl bg-[rgb(255,119,34)] py-4 text-sm font-black text-white shadow-[0_14px_40px_rgba(255,119,34,0.24)] transition hover:bg-[rgb(219,77,0)] disabled:opacity-50"
                  >
                    {submitting ? 'Submitting Application...' : 'Submit volunteer application'}
                  </button>
                </form>
              </section>
            )}
          </main>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-[rgb(220,224,233)] bg-[rgb(252,253,255)] p-5 shadow-[0_22px_48px_rgba(148,163,184,0.10)]">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Why volunteer</p>
              <h2 className="mt-4 text-xl font-black text-slate-900">Make an impact</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Apply fast with a compact form and get matched to the right volunteer role.</p>
                <div className="flex gap-2 text-slate-500">
                  <span>•</span>
                  <span>Fast review and clear next steps.</span>
                </div>
                <div className="flex gap-2 text-slate-500">
                  <span>•</span>
                  <span>Flexible schedules and smart matching.</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[rgb(220,224,233)] bg-[rgb(252,253,255)] p-5 shadow-[0_22px_48px_rgba(148,163,184,0.10)]">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">How it works</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-3xl border border-[rgb(216,219,233)] bg-[rgb(247,247,249)] p-4">
                  <p className="font-semibold text-slate-900">1. Apply</p>
                  <p className="mt-2 text-slate-600">Tell us your availability and top skills.</p>
                </div>
                <div className="rounded-3xl border border-[rgb(216,219,233)] bg-[rgb(247,247,249)] p-4">
                  <p className="font-semibold text-slate-900">2. Review</p>
                  <p className="mt-2 text-slate-600">We match you to the best-fit opportunity.</p>
                </div>
                <div className="rounded-3xl border border-[rgb(216,219,233)] bg-[rgb(247,247,249)] p-4">
                  <p className="font-semibold text-slate-900">3. Confirm</p>
                  <p className="mt-2 text-slate-600">Receive an update with next steps.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
