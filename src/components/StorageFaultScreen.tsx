import { useSyncExternalStore } from 'react';
import { subscribeFaults, getFaults, getFaultRaw, clearFault } from '../utils/storage';

export function StorageFaultScreen() {
  const faults = useSyncExternalStore(subscribeFaults, () => getFaults().join('|'));
  if (!faults) return null;
  const keys = faults.split('|');
  const download = (k: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([getFaultRaw(k)], { type: 'text/plain' }));
    a.download = `${k}-raw.txt`; a.click();
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 text-white flex items-center justify-center p-6">
      <div className="max-w-lg space-y-4">
        <h2 className="text-xl font-bold">Saved data could not be read</h2>
        <p>Nothing has been overwritten. Download the raw data below, then restore from a backup (Settings → Backup) or start fresh.</p>
        {keys.map(k => (
          <div key={k} className="flex gap-2 items-center">
            <code className="flex-1 truncate">{k}</code>
            <button onClick={() => download(k)}>Download raw</button>
            <button onClick={() => confirm(`Delete ${k} and start empty?`) && clearFault(k, true)}>Start empty</button>
          </div>
        ))}
      </div>
    </div>
  );
}
