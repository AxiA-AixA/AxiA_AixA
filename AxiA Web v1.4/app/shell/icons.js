// Small line icons for the sidebar (16 px, currentColor).
const I = (d) => function Icon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );
};
export const MapIcon = I(<><circle cx="8" cy="8" r="2" /><circle cx="3" cy="3.5" r="1.3" /><circle cx="13" cy="4" r="1.3" /><circle cx="12.5" cy="12.5" r="1.3" /><circle cx="3.5" cy="12" r="1.3" /><path d="M4 4.4 6.5 6.6M12 4.8 9.6 6.9M11.6 11.6 9.4 9.3M4.5 11.2 6.6 9.3" /></>);
export const ProjectsIcon = I(<><rect x="2" y="2.5" width="5" height="5" rx="1" /><rect x="9" y="2.5" width="5" height="5" rx="1" /><rect x="2" y="9.5" width="5" height="4" rx="1" /><rect x="9" y="9.5" width="5" height="4" rx="1" /></>);
export const LibraryIcon = I(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><circle cx="6" cy="6.5" r="1.2" /><path d="m2.5 12 3.5-3.5 2.5 2.5 2-2 3 3" /></>);
export const AboutIcon = I(<><circle cx="8" cy="8" r="6" /><path d="M8 7.5V11M8 5h.01" /></>);
export const SearchIcon = I(<><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></>);
export const FeedbackIcon = I(<path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />);
export const SettingsIcon = I(<><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></>);
export const PlusIcon = I(<path d="M8 3v10M3 8h10" />);
export const GridIcon = I(<><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></>);
export const MoreIcon = I(<><circle cx="3.5" cy="8" r=".6" /><circle cx="8" cy="8" r=".6" /><circle cx="12.5" cy="8" r=".6" /></>);
export const ChevronIcon = I(<path d="m4.5 6.5 3.5 3.5 3.5-3.5" />);
