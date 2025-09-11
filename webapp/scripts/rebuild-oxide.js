try {
    require('@tailwindcss/oxide');
    console.log('Oxide loaded successfully');
  } catch (e) {
    console.warn('Oxide rebuild failed, continuing without it:', e.message);
    console.log('TailwindCSS will fallback to slower compilation without Oxide');
    // Don't exit with error - allow build to continue
  }
