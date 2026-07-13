import { useState, useRef, useEffect } from 'react';

export default function MultiSelectMembers({ selectedMembers, onSelectionChange, availableMembers = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMembers = availableMembers.filter(m =>
    (m.name || m.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.email || m.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleMember = (memberId) => {
    const isSelected = selectedMembers.some(m => m.id === memberId || m.userId === memberId);
    if (isSelected) {
      onSelectionChange(selectedMembers.filter(m => m.id !== memberId && m.userId !== memberId));
    } else {
      const member = availableMembers.find(m => m.id === memberId || m.userId === memberId);
      onSelectionChange([...selectedMembers, member]);
    }
  };

  const handleRemoveMember = (memberId, e) => {
    e.stopPropagation();
    onSelectionChange(selectedMembers.filter(m => m.id !== memberId && m.userId !== memberId));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 cursor-pointer"
      >
        <div className="flex flex-wrap gap-2">
          {selectedMembers.length === 0 ? (
            <span className="text-slate-500">Select team members...</span>
          ) : (
            selectedMembers.map(member => (
              <div
                key={member.id || member.userId}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                <span>{member.name || member.userName}</span>
                <button
                  onClick={(e) => handleRemoveMember(member.id || member.userId, e)}
                  className="ml-1 hover:text-brand-900"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-3">
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-slate-500">
                No members found
              </div>
            ) : (
              filteredMembers.map(member => {
                const isSelected = selectedMembers.some(m => m.id === member.id || m.userId === member.userId);
                return (
                  <label
                    key={member.id || member.userId}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleMember(member.id || member.userId)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {member.name || member.userName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member.email || member.userEmail}
                      </p>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
