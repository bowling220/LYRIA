# LYRIA Chat

A modern, real-time messaging platform built with Firebase and vanilla JavaScript.

## 🚀 Features

- **Real-time Messaging**: Instant communication with friends and communities
- **User Authentication**: Secure login with Google or anonymous access
- **Channel System**: Create and join channels for organized conversations
- **Friend System**: Add friends and see their online status
- **Premium Features**: Upgrade for enhanced functionality
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **Dark/Light Theme**: Toggle between themes for better user experience

## 📁 Project Structure

```
LYRIA/
├── assets/
│   └── images/          # Image assets (logos, icons, etc.)
├── css/
│   ├── main.css         # Main consolidated stylesheet
│   └── components/      # Component-specific styles
├── js/
│   ├── config.js        # Firebase configuration
│   ├── utils.js         # Utility functions and error handling
│   └── modules/         # JavaScript modules
├── chat.js              # Main chat functionality
├── voiceCall.js         # Voice calling features
├── inbox.js             # Inbox and friend request handling
├── index.html           # Landing page
├── home.html            # Main chat application
├── login.html           # Authentication page
├── inbox.html           # Inbox page
├── News.html            # News feed
└── premium-upgrade.html # Premium upgrade page
```

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LYRIA
   ```

2. **Configure Firebase**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Google and Anonymous providers)
   - Enable Firestore Database
   - Replace Firebase config in `js/config.js` with your project credentials

3. **Set up environment variables** (Optional but recommended)
   Create a `.env` file or configure your hosting environment with:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Serve the application**
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Or use any static file server
   ```

5. **Access the application**
   Open your browser to `http://localhost:8000`

## 🔧 Configuration

### Firebase Security Rules

Update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for friends
    }
    
    // Channel access
    match /channels/{channelId} {
      allow read, write: if request.auth != null 
        && request.auth.uid in resource.data.members;
    }
    
    // Messages within channels
    match /channels/{channelId}/messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Friend requests
    match /friendRequests/{requestId} {
      allow read, write: if request.auth != null 
        && (request.auth.uid == resource.data.from || request.auth.uid == resource.data.to);
    }
  }
}
```

## 🎨 Customization

### Themes

The application supports theme customization through CSS custom properties. Modify `css/main.css`:

```css
:root {
  --primary-color: #36393f;
  --secondary-color: #5865f2;
  --accent-color: #43b581;
  /* ... other variables */
}
```

### Adding New Features

1. Create new modules in `js/modules/`
2. Add component-specific styles in `css/components/`
3. Follow the existing patterns for error handling and user feedback

## 📱 Mobile Support

The application is fully responsive and includes:
- Touch-friendly navigation
- Responsive sidebar
- Optimized layouts for small screens
- Progressive Web App (PWA) features

## 🔐 Security Features

- **Input Sanitization**: All user inputs are sanitized to prevent XSS
- **Authentication**: Firebase Authentication with secure token handling
- **Environment Variables**: Sensitive configuration moved to environment variables
- **HTTPS**: Designed to work over HTTPS in production

## 🚀 Performance Optimizations

- **CSS Custom Properties**: Efficient theming and consistent styling
- **Debounced Search**: Optimized search functionality
- **Lazy Loading**: Images and components load as needed
- **Offline Support**: Basic offline functionality with Firestore persistence
- **Error Boundaries**: Graceful error handling and recovery

## 🧪 Testing

### Manual Testing Checklist

- [ ] User can sign in with Google
- [ ] User can sign in as guest
- [ ] Messages are sent and received in real-time
- [ ] Users can create and join channels
- [ ] Friend system works correctly
- [ ] Mobile navigation functions properly
- [ ] Error messages display appropriately
- [ ] Offline mode works

### Browser Compatibility

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use modern ES6+ JavaScript
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure mobile responsiveness

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔍 Troubleshooting

### Common Issues

**Firebase Connection Issues**
- Ensure Firebase config is correct
- Check that Firestore rules allow access
- Verify network connectivity

**Authentication Problems**
- Check Firebase Authentication settings
- Ensure authorized domains are configured
- Clear browser cache and cookies

**Real-time Updates Not Working**
- Check console for WebSocket errors
- Verify Firestore security rules
- Test with different networks

**Mobile Navigation Issues**
- Clear browser cache
- Check for JavaScript errors in mobile inspector
- Test on different mobile browsers

### Getting Help

1. Check the browser console for errors
2. Review Firebase console for quota/billing issues
3. Search existing issues in the repository
4. Create a new issue with detailed information

## 📊 Analytics & Monitoring

The application includes Firebase Analytics integration. Monitor:
- User engagement metrics
- Error rates
- Performance metrics
- Feature usage

## 🔄 Updates & Maintenance

### Regular Tasks
- Update Firebase SDK versions
- Review and update security rules
- Monitor performance metrics
- Update browser compatibility list
- Review and improve accessibility

### Version History

- **v5.0.1**: Current stable version with improved architecture
- **v5.0.0**: Major refactor with consolidated CSS and better structure
- **Previous versions**: Legacy implementations

---

**Built with ❤️ by the LYRIA Team**

For questions or support, please contact the development team or create an issue on GitHub.