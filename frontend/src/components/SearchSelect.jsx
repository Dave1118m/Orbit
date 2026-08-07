import React from 'react';
import Select from 'react-select';

const customStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem', // rounded-xl
    borderColor: state.isFocused ? '#5A45FF' : '#cbd5e1', // brand-500 (#5A45FF) vs slate-300
    boxShadow: state.isFocused ? '0 0 0 3px rgba(90, 69, 255, 0.2)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    padding: '2px 4px',
    backgroundColor: '#ffffff',
    fontSize: '0.875rem',
    cursor: 'pointer',
    minHeight: '42px',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: '#5A45FF'
    }
  }),
  option: (base, state) => ({
    ...base,
    fontSize: '0.875rem',
    backgroundColor: state.isSelected 
      ? '#5A45FF' 
      : state.isFocused 
      ? 'rgba(90, 69, 255, 0.08)' 
      : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#0f172a',
    cursor: 'pointer',
    padding: '10px 14px',
    fontWeight: state.isSelected ? '600' : '400',
    '&:active': {
      backgroundColor: 'rgba(90, 69, 255, 0.15)'
    }
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    boxShadow: '0 10px 25px -5px rgba(90, 69, 255, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
    zIndex: 9999,
    overflow: 'hidden',
    border: '1px solid rgba(90, 69, 255, 0.15)'
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'rgba(90, 69, 255, 0.12)', // brand-500 translucent
    borderRadius: '0.5rem',
    padding: '2px 6px'
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#4835D8', // brand-600
    fontWeight: '600',
    fontSize: '0.75rem',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#5A45FF',
    borderRadius: '0.375rem',
    '&:hover': {
      backgroundColor: 'rgba(90, 69, 255, 0.25)',
      color: '#4835D8'
    }
  }),
  input: (base) => ({
    ...base,
    color: '#0f172a'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#0f172a',
    fontWeight: '500'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8',
    fontSize: '0.875rem'
  })
};

export default function SearchSelect({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Search & select...", 
  isMulti = false, 
  isClearable = true, 
  isDisabled = false, 
  isLoading = false,
  className = "",
  menuPortalTarget = typeof document !== 'undefined' ? document.body : null
}) {
  // Map value to react-select option object structure
  const getValue = () => {
    if (isMulti) {
      if (!Array.isArray(value)) return [];
      return value.map(v => {
        if (typeof v === 'object' && v !== null && 'value' in v) return v;
        const found = options.find(o => o.value === v);
        return found || { value: v, label: String(v) };
      });
    } else {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'object' && value !== null && 'value' in value) return value;
      const found = options.find(o => o.value === value);
      return found || { value: value, label: String(value) };
    }
  };

  const handleChange = (selected) => {
    if (isMulti) {
      const rawValues = selected ? selected.map(o => o.value) : [];
      onChange(rawValues, selected);
    } else {
      const rawValue = selected ? selected.value : null;
      onChange(rawValue, selected);
    }
  };

  return (
    <Select
      options={options}
      value={getValue()}
      onChange={handleChange}
      placeholder={placeholder}
      isMulti={isMulti}
      isClearable={isClearable}
      isDisabled={isDisabled}
      isLoading={isLoading}
      styles={customStyles}
      menuPortalTarget={menuPortalTarget}
      className={className}
    />
  );
}
