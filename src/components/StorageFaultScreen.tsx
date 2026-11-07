import { useSyncExternalStore } from 'react';
import { subscribeFaults, getFaults, getFaultRaw, clearFault, getSyncFaults } from '../utils/storage';

export function StorageFaultScreen() {
  const faults = useSyncExternalStore(subscribeFaults, () => getFaults().join('|'));
  // Fix P1-5: keys whose backend sync has failed persistently (the same
  // external-store mechanism as data faults above).
  const syncFaults = useSyncExternalStore(subscribeFaults, () => getSyncFaults().join('|'));
  if (!faults && !syncFaults) return null;
  const keys = faults ? faults.split('|') : [];
  const syncKeys = syncFaults ? syncFaults.split('|') : [];
  const download = (k: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([getFaultRaw(k)], { type: 'text/plain' }));
    a.download = `${k}-raw.txt`; a.click();
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 text-white flex items-center justify-center p-6">
      <div className="max-w-lg space-y-4">
        {keys.length > 0 && (
          <>
            <h2 className="text-xl font-bold">Saved data could not be read</h2>
            <p>Nothing has been overwritten. Download the raw data below, then restore from a backup (Settings → Backup) or start fresh.</p>
            {keys.map(k => (
              <div key={k} className="flex gap-2 items-center">
                <code className="flex-1 truncate">{k}</code>
                <button onClick={() => download(k)}>Download raw</button>
                <button onClick={() => confirm(`Delete ${k} and start empty?`) && clearFault(k, true)}>Start empty</button>
              </div>
            ))}
          </>
        )}
        {syncKeys.length > 0 && (
          <div className="space-y-2 border-t border-white/20 pt-4">
            <h2 className="text-xl font-bold">Changes could not be saved to the database</h2>
            <p>
              The SchoolEx database did not accept the latest changes for the data below. They are kept
              safely on this device and are retried automatically — do not clear this app's stored data
              until this message disappears.
            </p>
            {syncKeys.map(k => (
              <code key={k} className="block truncate">{k}</code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
