export const siteConfig = {
  organizerName: import.meta.env.VITE_ORGANIZER_NAME || 'Acme Corp',
  organizerLogo: import.meta.env.VITE_ORGANIZER_LOGO || '',
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR || '#4F46E5',
  poweredBy: {
    show: import.meta.env.VITE_SHOW_POWERED_BY !== 'false',
    text: 'Powered by OpenHackathon',
    url: 'https://openhackathon.dev',
  },
}
