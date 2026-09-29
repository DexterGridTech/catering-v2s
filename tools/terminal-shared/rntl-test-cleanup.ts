export const cleanupRntlTestCase = async (cleanup: () => Promise<void>, reset: () => void): Promise<void> => {
  try {
    await cleanup();
  } finally {
    reset();
  }
};
