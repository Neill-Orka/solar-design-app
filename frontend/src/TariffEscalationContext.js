import React, { createContext, useState } from 'react';

export const EscalationContext = createContext({
  schedule: [],           // [0.12, 0.06, 0.05, 0.09, …]
  setSchedule: () => {}
});

export function EscalationProvider({ children }) {
  const defaultSchedule = [
    0.12, // 2025–2026
    0.06, // 2026–2027
    0.05, // 2027–2028
    ...Array(17).fill(0.09) // all later years
  ];
  const [schedule, setSchedule] = useState(defaultSchedule);

  return (
    <EscalationContext.Provider value={{ schedule, setSchedule }}>
      {children}
    </EscalationContext.Provider>
  );
}