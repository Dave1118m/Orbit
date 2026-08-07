import SearchSelect from './SearchSelect';

export default function MultiSelectMembers({ selectedMembers = [], onSelectionChange, availableMembers = [] }) {
  const options = availableMembers.map(m => ({
    value: m.id || m.userId,
    label: `${m.name || m.userName} (${m.email || m.userEmail || 'No email'})`,
    raw: m
  }));

  const selectedValues = selectedMembers.map(m => m.id || m.userId);

  const handleChange = (rawValues) => {
    const selectedObjects = availableMembers.filter(m => rawValues.includes(m.id || m.userId));
    onSelectionChange(selectedObjects);
  };

  return (
    <SearchSelect
      options={options}
      value={selectedValues}
      onChange={handleChange}
      isMulti={true}
      placeholder="Type to search and select members..."
    />
  );
}
