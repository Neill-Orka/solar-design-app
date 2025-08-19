# Production Deployment Guide

## Backend Deployment (Render/Railway/Heroku)

### 1. Environment Variables Setup
Set these environment variables in your hosting platform:

```bash
# Database
DATABASE_URL=postgresql://username:password@hostname:port/database

# Security
JWT_SECRET_KEY=generate-a-secure-random-string-32-chars
SECRET_KEY=generate-another-secure-random-string-32-chars

# Email Configuration (Gmail example)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password  # Use App Password, not regular password
MAIL_DEFAULT_SENDER=noreply@orkasolar.co.za

# Application
ADMIN_EMAIL=admin@orkasolar.co.za
FRONTEND_URL=https://your-app-name.vercel.app
FLASK_ENV=production
ALLOWED_EMAIL_DOMAIN=@orkasolar.co.za
```

### 2. Database Setup
- Create a PostgreSQL database on your hosting platform
- Run migrations: `flask db upgrade`
- Create first admin user (you'll need to do this manually in production)

### 3. Email Setup (Gmail)
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use this App Password as MAIL_PASSWORD

## Frontend Deployment (Vercel)

### 1. Environment Variables
Set in Vercel dashboard:
```bash
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

### 2. Build Settings
- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

## User Invitation Flow in Production

### 1. Admin Invites User
- Admin goes to Admin Dashboard
- Fills in: First Name, Last Name, Email, Role
- System creates user account (inactive)
- Email sent to user with invitation link

### 2. User Accepts Invitation
- User clicks link in email → `/accept-invitation/{token}`
- User sets their password (must meet requirements)
- Account becomes active
- User redirected to login page

### 3. User Logs In
- Use email and password they set
- Full access based on their role

## Email Requirements
- **First Name & Last Name**: Required for invitation
- **Password**: Set by user when accepting invitation
- **Email Domain**: Must be @orkasolar.co.za (configurable)

## Password Requirements
- At least 8 characters
- 1 uppercase letter
- 1 lowercase letter  
- 1 number
- 1 special character

## Security Features
- JWT tokens with expiration
- Refresh token rotation
- Role-based access control
- Email domain restriction
- Password strength validation
- Audit logging for admin actions

## Testing the System

### Development
1. Start backend: `python app.py`
2. Start frontend: `npm start`
3. Create admin user manually in database
4. Test invitation flow

### Production
1. Verify environment variables are set
2. Test database connection
3. Test email sending
4. Test invitation flow end-to-end
5. Monitor logs for any issues

## Troubleshooting

### Email Not Sending
- Check MAIL_USERNAME and MAIL_PASSWORD
- Verify Gmail App Password is correct
- Check spam folder
- Verify SMTP settings

### Database Issues
- Check DATABASE_URL format
- Ensure migrations are applied
- Verify database permissions

### Frontend Issues
- Check REACT_APP_API_URL is correct
- Verify CORS settings in backend
- Check network connectivity between frontend and backend
