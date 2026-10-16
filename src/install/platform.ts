/** The OS the browser runs on, for the gate's ordering and tips. */
export type Platform = 'mac' | 'win' | 'linux';

interface UserAgentDataNavigator {
  userAgentData?: { platform?: string };
}

export const userPlatform = (): Platform => {
  const platform =
    (navigator as UserAgentDataNavigator).userAgentData?.platform || navigator.userAgent;
  if (/mac/i.test(platform)) return 'mac';
  if (/win/i.test(platform)) return 'win';
  return 'linux';
};

/**
 * Steam's default library sits in a folder Chrome's File System Access blocklist
 * refuses (`~/Library` on macOS, `Program Files` on Windows). There both the folder
 * picker and a dropped item's handle only bring up a "contains system files" dialog.
 */
export const steamFolderBlocked = (): boolean => userPlatform() !== 'linux';
