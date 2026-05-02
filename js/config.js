const CONFIG = {
  GOOGLE_CLIENT_ID: '1098716197953-o8m1ard7phqk1lu3sd39bcptfjbqnsd6.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/photoslibrary.readonly profile email',
  DESTINATIONS: [
    {
      id: 'lv',
      name: 'Las Vegas',
      emoji: '🎰',
      bounds: [35.95, 36.35, -115.45, -114.90],
      tags: ['nightlife','dining','shows','casino','pool','shopping','day trip','spa','hotel']
    },
    {
      id: 'sc',
      name: 'Scotland',
      emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      bounds: [54.5, 60.9, -7.6, -0.7],
      tags: ['castle','highlands','whisky','hiking','history','pub','coastal','festival','glen']
    },
    {
      id: 'pnw',
      name: 'Pacific Northwest',
      emoji: '🌲',
      bounds: [42.0, 54.5, -124.8, -116.5],
      tags: ['hiking','mountains','coast','coffee','market','ferry','national park','rain','food']
    }
  ]
};
