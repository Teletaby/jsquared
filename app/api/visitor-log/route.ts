import { NextResponse } from 'next/server';
import { logVisitor, VisitorLog } from '@/lib/visitorLogging';
import { isLoggingEnabled } from '@/lib/loggingState';

export async function POST(request: Request) {
  // Check if logging is enabled globally
  const loggingEnabled = isLoggingEnabled();
  console.log('Visitor logging request received. Logging enabled:', loggingEnabled);
  
  if (!loggingEnabled) {
    console.log('Logging is disabled, skipping log entry');
    return NextResponse.json({ message: 'Logging is disabled' }, { status: 200 });
  }

  try {
    const body = await request.json();
    const {
      userAgent,
      referer,
      url,
      pageLoadTime,
      userId,
    } = body;

    console.log('Processing visitor log for URL:', url);

    // Get IP address
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Simple browser detection from user agent
    const getBrowserInfo = (ua: string) => {
      let browserName = 'Unknown';
      let browserVersion = 'Unknown';

      if (ua.includes('Chrome')) {
        browserName = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        if (match) browserVersion = match[1];
      } else if (ua.includes('Safari')) {
        browserName = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        if (match) browserVersion = match[1];
      } else if (ua.includes('Firefox')) {
        browserName = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        if (match) browserVersion = match[1];
      } else if (ua.includes('Edge')) {
        browserName = 'Edge';
        const match = ua.match(/Edg\/(\d+)/);
        if (match) browserVersion = match[1];
      }

      return { browserName, browserVersion };
    };

    // Simple OS detection from user agent
    const getOSInfo = (ua: string) => {
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Macintosh')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      return 'Unknown';
    };

    const { browserName, browserVersion } = getBrowserInfo(userAgent || '');
    const operatingSystem = getOSInfo(userAgent || '');

    const visitorLog: VisitorLog = {
      ipAddress,
      userAgent: userAgent || '',
      browser: browserName,
      browserVersion: browserVersion,
      operatingSystem: operatingSystem,
      timestamp: new Date(),
      url: url || '/',
      referer: referer || undefined,
      pageLoadTime: pageLoadTime || undefined,
      userId: userId || undefined,
    };

    console.log('Prepared visitor log:', {
      ipAddress,
      browser: browserName,
      os: operatingSystem,
      url,
    });

    // Log visitor asynchronously without blocking response
    logVisitor(visitorLog).then(() => {
      console.log('Visitor log saved successfully');
    }).catch((error) => {
      console.error('Error logging visitor to database:', error);
      // Don't throw - let the response go through even if logging fails
    });

    return NextResponse.json(
      { message: 'Visitor logged successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in visitor logging API:', error);
    // Return success anyway to not block the user experience
    return NextResponse.json(
      { message: 'Request processed' },
      { status: 200 }
    );
  }
}
