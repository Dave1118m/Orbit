import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ChevronDown, Search, Plus, X } from 'lucide-react';
import { parseApiResponse } from '../utils/toastHelper';

const API_BASE = import.meta.env.VITE_API_URL;

// Curated comprehensive international country list with dial codes, digit constraints, and formatting
const COUNTRY_LIST = [
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', flag: '🇪🇹', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '91 123 4567', hint: '9 digits starting with 9 or 7' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', digits: 10, minDigits: 10, maxDigits: 10, format: '(XXX) XXX-XXXX', placeholder: '(555) 000-0000', hint: '10 digits' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', digits: 10, minDigits: 10, maxDigits: 10, format: '(XXX) XXX-XXXX', placeholder: '(555) 000-0000', hint: '10 digits' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', digits: 10, minDigits: 10, maxDigits: 10, format: 'XXXX XXXXXX', placeholder: '7911 123456', hint: '10 digits' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', digits: 9, minDigits: 9, maxDigits: 9, format: 'XXX XXX XXX', placeholder: '712 345 678', hint: '9 digits' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', digits: 10, minDigits: 10, maxDigits: 10, format: 'XXX XXX XXXX', placeholder: '803 123 4567', hint: '10 digits' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '82 123 4567', hint: '9 digits' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '50 123 4567', hint: '9 digits' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '50 123 4567', hint: '9 digits' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', digits: 10, minDigits: 10, maxDigits: 10, format: 'XXXXX XXXXX', placeholder: '98765 43210', hint: '10 digits' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', digits: 10, minDigits: 10, maxDigits: 11, format: 'XXX XXXXXXXX', placeholder: '151 12345678', hint: '10-11 digits' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', digits: 9, minDigits: 9, maxDigits: 9, format: 'X XX XX XX XX', placeholder: '6 12 34 56 78', hint: '9 digits' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', digits: 9, minDigits: 9, maxDigits: 9, format: 'XXX XXX XXX', placeholder: '412 345 678', hint: '9 digits' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', digits: 10, minDigits: 10, maxDigits: 10, format: 'XXX XXX XXXX', placeholder: '100 123 4567', hint: '10 digits' },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬', digits: 9, minDigits: 9, maxDigits: 9, format: 'XXX XXX XXX', placeholder: '712 345 678', hint: '9 digits' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', digits: 9, minDigits: 9, maxDigits: 9, format: 'XXX XXX XXX', placeholder: '788 123 456', hint: '9 digits' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', digits: 9, minDigits: 9, maxDigits: 9, format: 'XXX XXX XXX', placeholder: '712 345 678', hint: '9 digits' },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', flag: '🇩🇯', digits: 8, minDigits: 8, maxDigits: 8, format: 'XX XX XX XX', placeholder: '77 12 34 56', hint: '8 digits' },
  { code: 'SO', name: 'Somalia', dialCode: '+252', flag: '🇸🇴', digits: 8, minDigits: 8, maxDigits: 9, format: 'XX XXX XXX', placeholder: '61 234 567', hint: '8-9 digits' },
  { code: 'SD', name: 'Sudan', dialCode: '+249', flag: '🇸🇩', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '91 234 5678', hint: '9 digits' },
  { code: 'SS', name: 'South Sudan', dialCode: '+211', flag: '🇸🇸', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '92 123 4567', hint: '9 digits' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XXXX', placeholder: '24 123 4567', hint: '9 digits' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', digits: 11, minDigits: 11, maxDigits: 11, format: 'XXX XXXX XXXX', placeholder: '138 0000 0000', hint: '11 digits' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', digits: 10, minDigits: 10, maxDigits: 10, format: 'XX XXXX XXXX', placeholder: '90 1234 5678', hint: '10 digits' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', digits: 11, minDigits: 10, maxDigits: 11, format: 'XX XXXXX-XXXX', placeholder: '11 98765-4321', hint: '10-11 digits' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', digits: 10, minDigits: 10, maxDigits: 10, format: 'XX XXXX XXXX', placeholder: '55 1234 5678', hint: '10 digits' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', digits: 10, minDigits: 9, maxDigits: 10, format: 'XXX XXX XXXX', placeholder: '312 345 6789', hint: '9-10 digits' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', digits: 9, minDigits: 9, maxDigits: 9, format: 'XXX XXX XXX', placeholder: '612 345 678', hint: '9 digits' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', digits: 9, minDigits: 9, maxDigits: 9, format: 'X XXXXXXXX', placeholder: '6 12345678', hint: '9 digits' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XX XX', placeholder: '70 123 45 67', hint: '9 digits' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', digits: 9, minDigits: 9, maxDigits: 9, format: 'XX XXX XX XX', placeholder: '78 123 45 67', hint: '9 digits' }
];

// Common typo domains to block (e.g. gmial.com, age@gmail.dom)
const COMMON_DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahou.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlock.com': 'outlook.com',
  'iclloud.com': 'icloud.com',
  'iclod.com': 'icloud.com'
};

const INVALID_TLDS = new Set([
  'dom', 'cmo', 'con', 'comm', 'coom', 'cm', 'orgn', 'orgg', 'nett', 'eddu', 'gove', 'ocm'
]);

const PRESET_SKILLS = [
  'Teaching & Tutoring',
  'Medical & First Aid',
  'Construction & Repair',
  'Cooking & Nutrition',
  'Counseling & Support',
  'Technology & IT',
  'Arts & Creative',
  'Administration',
  'Driving & Logistics',
  'Languages & Translation'
];

const AVAILABILITY_OPTIONS = [
  { id: 'weekdays', label: 'Weekdays', desc: 'Monday to Friday daytime' },
  { id: 'weekends', label: 'Weekends Only', desc: 'Saturday & Sunday' },
  { id: 'evenings', label: 'Evenings', desc: 'After 5:00 PM' },
  { id: 'flexible', label: 'Flexible / On-Call', desc: 'As needed for events' },
  { id: 'part_time', label: 'Part-Time (10-20 hrs/wk)', desc: 'Regular scheduled shifts' },
  { id: 'full_time', label: 'Full-Time (30+ hrs/wk)', desc: 'Dedicated project commitment' }
];

export default function VolunteerPublicApply() {
  const [searchParams] = useSearchParams();
  const preselectedOrgId = searchParams.get('orgId');

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(preselectedOrgId ? parseInt(preselectedOrgId, 10) : null);

  // Genuine live community statistics from backend database (no mock data)
  const [liveStats, setLiveStats] = useState({
    volunteers: 0,
    programs: 0,
    members: 0,
    organizations: 0
  });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Country code selector & phone state
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_LIST[0]); // Default Ethiopia
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const countryDropdownRef = useRef(null);

  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [showCustomSkillInput, setShowCustomSkillInput] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState(['weekdays']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setIsCountryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchOrganizations();
    fetchLiveStats();
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

  const fetchLiveStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/volunteers/public-stats`);
      if (res.ok) {
        const data = await res.json();
        setLiveStats({
          volunteers: typeof data.volunteers === 'number' ? data.volunteers : 0,
          programs: typeof data.programs === 'number' ? data.programs : 0,
          members: typeof data.members === 'number' ? data.members : 0,
          organizations: typeof data.organizations === 'number' ? data.organizations : 0
        });
      }
    } catch (err) {
      console.error('Failed to load public stats', err);
    }
  };

  // Filter countries in search dropdown
  const filteredCountries = useMemo(() => {
    if (!countrySearchQuery.trim()) return COUNTRY_LIST;
    const q = countrySearchQuery.toLowerCase();
    return COUNTRY_LIST.filter(
      c => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearchQuery]);

  // Strict email validation checking structure, typos, and invalid TLDs (e.g. .dom, gmial.com)
  const validateEmailFormat = (val) => {
    if (!val || !val.trim()) {
      setEmailError('Email address is required.');
      return false;
    }
    const clean = val.trim().toLowerCase();

    // Basic email RFC regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(clean)) {
      setEmailError('Please enter a valid email address format.');
      return false;
    }

    const parts = clean.split('@');
    if (parts.length !== 2) {
      setEmailError('Invalid email structure.');
      return false;
    }

    const domain = parts[1];

    // Check for common domain typos
    if (COMMON_DOMAIN_TYPOS[domain]) {
      setEmailError(`Typo in domain "${domain}". Did you mean "${COMMON_DOMAIN_TYPOS[domain]}"?`);
      return false;
    }

    // Check for invalid TLDs like .dom, .cmo, etc.
    const domainSegments = domain.split('.');
    const tld = domainSegments[domainSegments.length - 1];

    if (INVALID_TLDS.has(tld)) {
      setEmailError(`Invalid domain extension ".${tld}". Please use a valid extension like .com or .org.`);
      return false;
    }

    if (tld.length < 2) {
      setEmailError('Domain extension must be at least 2 characters.');
      return false;
    }

    setEmailError('');
    return true;
  };

  // Phone number change & digit count validation
  const handlePhoneChange = (e) => {
    // Only accept numeric digits
    const raw = e.target.value.replace(/\D/g, '');
    const maxDigits = selectedCountry.maxDigits || 15;
    const trimmed = raw.slice(0, maxDigits);
    setPhoneDigits(trimmed);
    validatePhoneDigits(trimmed, selectedCountry);
  };

  const validatePhoneDigits = (digits, country) => {
    if (!digits) {
      setPhoneError('Phone number is required.');
      return false;
    }
    const min = country.minDigits;
    const max = country.maxDigits;

    if (min === max && digits.length !== min) {
      setPhoneError(`${country.name} requires exactly ${min} digits (currently ${digits.length}).`);
      return false;
    } else if (digits.length < min || digits.length > max) {
      setPhoneError(`${country.name} requires between ${min} and ${max} digits (currently ${digits.length}).`);
      return false;
    }

    // Special prefix checks (e.g. Ethiopia mobile numbers start with 9 or 7)
    if (country.code === 'ET' && !['9', '7'].includes(digits[0])) {
      setPhoneError('Ethiopian mobile numbers typically start with 9 or 7.');
      return false;
    }

    setPhoneError('');
    return true;
  };

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setIsCountryDropdownOpen(false);
    setCountrySearchQuery('');
    // Re-validate existing digits against new country rules
    validatePhoneDigits(phoneDigits, country);
  };

  const toggleSkill = (skill) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    const trimmed = customSkillInput.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills(prev => [...prev, trimmed]);
      setCustomSkillInput('');
      setShowCustomSkillInput(false);
    }
  };

  const toggleAvailability = (id) => {
    setSelectedAvailability(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(a => a !== id) : prev) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedOrgId) {
      setError('Please select an organization to apply to.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your first and last name.');
      return;
    }

    // Enforce email validation
    const isEmailValid = validateEmailFormat(email);
    if (!isEmailValid) {
      setError(emailError || 'Please provide a valid email address.');
      return;
    }

    // Enforce phone validation
    const isPhoneValid = validatePhoneDigits(phoneDigits, selectedCountry);
    if (!isPhoneValid) {
      setError(phoneError || `Please enter a valid phone number for ${selectedCountry.name}.`);
      return;
    }

    if (selectedSkills.length === 0) {
      setError('Please select at least one skill.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const fullPhoneNumber = `${selectedCountry.dialCode} ${phoneDigits}`;
      const availabilityLabels = selectedAvailability
        .map(id => AVAILABILITY_OPTIONS.find(a => a.id === id)?.label || id)
        .join(', ');

      const payload = {
        organizationId: selectedOrgId,
        name: fullName,
        email: email.trim(),
        phoneNumber: fullPhoneNumber,
        skills: selectedSkills.join(', '),
        availability: availabilityLabels
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
      fetchLiveStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAF6F0] text-[#221C18] selection:bg-[#C4552D]/20 selection:text-[#C4552D] font-sans antialiased">
      {/* ── LEFT COLUMN: Rich Terracotta Brand & Hero Panel ── */}
      <div className="lg:w-[42%] xl:w-[40%] bg-[#C4552D] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative overflow-hidden shrink-0">
        {/* Subtle geometric circles matching Figma screenshot */}
        <div className="absolute -right-24 top-1/4 w-[380px] h-[380px] rounded-full bg-white/[0.08] pointer-events-none" />
        <div className="absolute -right-48 top-1/3 w-[460px] h-[460px] rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-[300px] h-[300px] rounded-full bg-black/[0.04] pointer-events-none" />

        {/* Top Tag & Orbit Link */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-[0.25em] text-[#F9D7CB] uppercase">
            Community Volunteers
          </div>
          <Link
            to="/login"
            className="text-xs font-semibold text-white/80 hover:text-white transition flex items-center gap-1.5"
          >
            <span>Staff Portal</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        {/* Center Headline & Mission Copy */}
        <div className="relative z-10 my-16 lg:my-auto">
          <h1 className="text-5xl sm:text-6xl xl:text-[4.25rem] font-serif font-normal text-white leading-[1.12] tracking-tight">
            Make a <span className="italic font-normal">real</span>
            <br />
            difference.
          </h1>

          <p className="mt-6 text-sm sm:text-base text-[#FBECE5]/90 leading-relaxed max-w-md font-sans font-light">
            Join volunteers who give their time, skills, and heart to uplift our community. Every hour counts.
          </p>

          {selectedOrg && (
            <div className="mt-8 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-white/95">
              <span className="h-2 w-2 rounded-full bg-[#F9D7CB] animate-pulse" />
              <span>Partnering with <strong className="font-semibold">{selectedOrg.name}</strong></span>
            </div>
          )}
        </div>

        {/* Bottom Statistics: 100% Genuine Live Data from Database */}
        <div className="relative z-10 pt-10 border-t border-white/20">
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            <div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white tracking-tight">
                {liveStats.volunteers.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#F9D7CB] uppercase mt-1">
                Volunteers
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white tracking-tight">
                {liveStats.programs.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#F9D7CB] uppercase mt-1">
                Programs
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white tracking-tight">
                {(liveStats.organizations || organizations.length).toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#F9D7CB] uppercase mt-1">
                Organizations
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Warm Linen Application Form ── */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-16 xl:px-20 py-8 sm:py-12 lg:py-16 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto">
          {submitted ? (
            /* ── Application Submitted Success State ── */
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#EADBCE] shadow-sm animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-[#FAF0EB] text-[#C4552D] flex items-center justify-center mb-6">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <h2 className="text-3xl font-serif font-normal text-[#221C18] tracking-tight">
                Application Received
              </h2>

              <p className="mt-3 text-sm text-[#7A7067] leading-relaxed">
                Thank you, <strong className="text-[#221C18]">{firstName}</strong>! Your application to volunteer with{' '}
                <strong className="text-[#C4552D]">{selectedOrg?.name || 'our organization'}</strong> has been verified and registered.
              </p>

              <div className="mt-8 rounded-2xl bg-[#FAF6F0] p-6 border border-[#E8DFC0]/70 text-xs text-[#52483E] space-y-2.5">
                <div className="font-bold text-[#221C18] text-sm mb-1">Registered Details:</div>
                <div className="flex items-center gap-2">
                  <span className="text-[#7A7067] font-semibold">Contact Email:</span>
                  <span className="font-mono text-[#221C18]">{email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#7A7067] font-semibold">Phone:</span>
                  <span className="font-mono text-[#221C18]">{selectedCountry.dialCode} {phoneDigits}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#7A7067] font-semibold">Skills:</span>
                  <span className="text-[#221C18]">{selectedSkills.join(', ')}</span>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFirstName('');
                    setLastName('');
                    setEmail('');
                    setPhoneDigits('');
                    setSelectedSkills([]);
                  }}
                  className="px-6 py-3 rounded-full border border-[#D8CEC4] text-xs font-semibold text-[#4A4036] hover:bg-[#FAF6F0] transition text-center cursor-pointer"
                >
                  Submit Another Application
                </button>
                <Link
                  to="/"
                  className="px-6 py-3 rounded-full bg-[#C4552D] text-white text-xs font-semibold hover:bg-[#B24620] transition shadow-sm text-center"
                >
                  Return to Orbit Homepage
                </Link>
              </div>
            </div>
          ) : (
            /* ── Application Form Matching Figma Design ── */
            <div>
              {/* Header */}
              <div className="mb-10">
                <h2 className="text-3xl sm:text-4xl font-serif font-normal text-[#221C18] tracking-tight">
                  Volunteer Application
                </h2>
                <p className="text-sm text-[#7A7067] mt-2">
                  Fill in your details — it takes less than 3 minutes.
                </p>
              </div>

              {/* Organization Switcher (Live Multi-Tenancy) */}
              {organizations.length > 0 && (
                <div className="mb-10 pb-6 border-b border-[#E8DFC0]/60">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C4552D] block mb-2">
                    Select Community Organization *
                  </label>
                  <select
                    value={selectedOrgId || ''}
                    onChange={e => setSelectedOrgId(parseInt(e.target.value, 10))}
                    className="w-full bg-transparent border-b border-[#D8CEC4] py-2.5 text-sm text-[#221C18] font-medium outline-none focus:border-[#C4552D] transition cursor-pointer"
                  >
                    {organizations.map(o => (
                      <option key={o.id} value={o.id} className="bg-white text-slate-900">
                        {o.name}
                      </option>
                    ))}
                  </select>
                  {selectedOrg?.description && (
                    <p className="text-xs text-[#7A7067] mt-2 italic line-clamp-2">
                      &ldquo;{selectedOrg.description}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-8 p-4 rounded-2xl bg-[#FDF2EC] border border-[#F6C7B4] text-xs text-[#A4411F] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#C4552D]" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-10">
                {/* 01 — PERSONAL INFO */}
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] text-[#C4552D] uppercase mb-4">
                    01 — Personal Info
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.15em] text-[#7A7067] uppercase block mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Elena"
                        className="w-full bg-transparent border-b border-[#D8CEC4] focus:border-[#C4552D] py-2 text-sm text-[#221C18] placeholder-[#B5ABA0] outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.15em] text-[#7A7067] uppercase block mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Vasquez"
                        className="w-full bg-transparent border-b border-[#D8CEC4] focus:border-[#C4552D] py-2 text-sm text-[#221C18] placeholder-[#B5ABA0] outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* 02 — CONTACT */}
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] text-[#C4552D] uppercase mb-4">
                    02 — Contact
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* EMAIL ADDRESS WITH STRICT TYPO & DOMAIN VALIDATION */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold tracking-[0.15em] text-[#7A7067] uppercase block">
                          Email Address *
                        </label>
                        {email && !emailError && (
                          <span className="text-[10px] text-emerald-600 font-medium">✓ Valid format</span>
                        )}
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value);
                          if (e.target.value.includes('@') && e.target.value.includes('.')) {
                            validateEmailFormat(e.target.value);
                          } else {
                            setEmailError('');
                          }
                        }}
                        onBlur={() => validateEmailFormat(email)}
                        placeholder="elena@example.com"
                        className={`w-full bg-transparent border-b py-2 text-sm text-[#221C18] placeholder-[#B5ABA0] outline-none transition ${
                          emailError ? 'border-rose-500 focus:border-rose-600' : 'border-[#D8CEC4] focus:border-[#C4552D]'
                        }`}
                      />
                      {emailError ? (
                        <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                          <span>⚠️</span> {emailError}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#A69B90] mt-1">
                          Example: name@domain.com, name@domain.org (typos like gmial.com or .dom rejected)
                        </p>
                      )}
                    </div>

                    {/* PHONE NUMBER WITH COUNTRY CODE SELECTOR & DIGIT VALIDATION */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold tracking-[0.15em] text-[#7A7067] uppercase block">
                          Phone Number *
                        </label>
                        <span className={`text-[10px] font-mono ${
                          phoneDigits.length === selectedCountry.digits ? 'text-emerald-600 font-bold' : 'text-[#7A7067]'
                        }`}>
                          {phoneDigits.length} / {selectedCountry.digits} digits
                        </span>
                      </div>

                      <div className="relative flex items-center border-b border-[#D8CEC4] focus-within:border-[#C4552D] transition">
                        {/* Country Code Trigger */}
                        <div className="relative" ref={countryDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                            className="flex items-center gap-1.5 py-2 pr-2 text-sm text-[#221C18] font-medium hover:text-[#C4552D] transition cursor-pointer"
                            title={`Selected: ${selectedCountry.name} (${selectedCountry.dialCode})`}
                          >
                            <span className="text-base">{selectedCountry.flag}</span>
                            <span className="font-mono text-xs">{selectedCountry.dialCode}</span>
                            <ChevronDown className="w-3 h-3 text-[#7A7067]" />
                          </button>

                          {/* Country Searchable Dropdown */}
                          {isCountryDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-xl border border-[#EADBCE] z-50 overflow-hidden animate-in fade-in duration-150">
                              <div className="p-2.5 border-b border-[#F0E6DC] bg-[#FAF6F0]">
                                <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1.5 border border-[#DDD3C7]">
                                  <Search className="w-3.5 h-3.5 text-[#7A7067]" />
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search country or code..."
                                    value={countrySearchQuery}
                                    onChange={e => setCountrySearchQuery(e.target.value)}
                                    className="w-full text-xs bg-transparent outline-none text-[#221C18] placeholder-[#B5ABA0]"
                                  />
                                </div>
                              </div>

                              <div className="max-h-56 overflow-y-auto divide-y divide-[#FAF6F0] p-1">
                                {filteredCountries.map(country => (
                                  <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => handleSelectCountry(country)}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl hover:bg-[#FAF6F0] transition ${
                                      selectedCountry.code === country.code ? 'bg-[#FDF2EC] font-bold text-[#C4552D]' : 'text-[#4A4036]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="text-sm">{country.flag}</span>
                                      <span className="truncate">{country.name}</span>
                                    </div>
                                    <span className="font-mono text-[11px] text-[#7A7067] ml-2 shrink-0">
                                      {country.dialCode}
                                    </span>
                                  </button>
                                ))}
                                {filteredCountries.length === 0 && (
                                  <div className="p-4 text-center text-xs text-[#7A7067]">
                                    No country matching "{countrySearchQuery}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Numeric Digits Input */}
                        <input
                          type="tel"
                          required
                          value={phoneDigits}
                          onChange={handlePhoneChange}
                          placeholder={selectedCountry.placeholder}
                          className="flex-1 bg-transparent py-2 text-sm text-[#221C18] placeholder-[#B5ABA0] outline-none font-mono"
                        />
                      </div>

                      {phoneError ? (
                        <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                          <span>⚠️</span> {phoneError}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#A69B90] mt-1">
                          {selectedCountry.name}: {selectedCountry.hint}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 03 — SKILLS */}
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] text-[#C4552D] uppercase mb-1">
                    03 — Skills
                  </div>
                  <p className="text-xs text-[#7A7067] mb-4">
                    Select all that apply
                  </p>

                  <div className="flex flex-wrap gap-2.5">
                    {PRESET_SKILLS.map(skill => {
                      const isSelected = selectedSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-4 py-2 rounded-full text-xs transition font-medium cursor-pointer ${
                            isSelected
                              ? 'bg-[#C4552D] border border-[#C4552D] text-white shadow-xs'
                              : 'bg-white/90 border border-[#DDD3C7] text-[#4A4036] hover:border-[#C4552D] hover:text-[#C4552D]'
                          }`}
                        >
                          {skill}
                        </button>
                      );
                    })}

                    {/* Custom skill chips */}
                    {selectedSkills
                      .filter(s => !PRESET_SKILLS.includes(s))
                      .map(skill => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className="px-4 py-2 rounded-full text-xs font-medium bg-[#C4552D] border border-[#C4552D] text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{skill}</span>
                          <X className="w-3 h-3 text-white/80" />
                        </button>
                      ))}

                    {/* Add Custom Skill Button */}
                    {!showCustomSkillInput ? (
                      <button
                        type="button"
                        onClick={() => setShowCustomSkillInput(true)}
                        className="px-3.5 py-2 rounded-full text-xs border border-dashed border-[#C4552D]/60 text-[#C4552D] hover:bg-[#C4552D]/5 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Other</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type custom skill..."
                          value={customSkillInput}
                          onChange={e => setCustomSkillInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomSkill(e);
                            }
                          }}
                          className="border-b border-[#C4552D] bg-transparent py-1 px-2 text-xs text-[#221C18] placeholder-[#B5ABA0] outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomSkill}
                          className="px-3 py-1 bg-[#C4552D] text-white text-xs font-semibold rounded-full hover:bg-[#B24620]"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomSkillInput(false);
                            setCustomSkillInput('');
                          }}
                          className="text-xs text-[#7A7067] hover:text-[#221C18] p-1"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 04 — AVAILABILITY */}
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] text-[#C4552D] uppercase mb-1">
                    04 — Availability
                  </div>
                  <p className="text-xs text-[#7A7067] mb-4">
                    When can you volunteer?
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVAILABILITY_OPTIONS.map(opt => {
                      const isChecked = selectedAvailability.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => toggleAvailability(opt.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                            isChecked
                              ? 'border-[#C4552D] bg-[#FDF6F2] shadow-xs'
                              : 'border-[#DDD3C7] bg-white hover:border-[#C4552D]/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAvailability(opt.id)}
                            className="mt-0.5 rounded border-slate-300 text-[#C4552D] focus:ring-[#C4552D] cursor-pointer"
                          />
                          <div>
                            <div className={`text-xs font-bold ${isChecked ? 'text-[#C4552D]' : 'text-[#221C18]'}`}>
                              {opt.label}
                            </div>
                            <div className="text-[11px] text-[#7A7067] mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Application Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !!emailError || !!phoneError}
                    className="w-full sm:w-auto px-10 py-4 rounded-full bg-[#C4552D] hover:bg-[#B24620] active:scale-98 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Submitting Application...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
