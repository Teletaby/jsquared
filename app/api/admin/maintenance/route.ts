// j-squared-cinema/app/api/admin/maintenance/route.ts
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Settings } from '@/lib/models';
import { authOptions } from '@/lib/auth';

// Helper to ensure settings document exists
async function ensureSettingsDocument() {
  await connectToDatabase();
  let settings = await Settings.findOne({ key: 'app_settings' });
  if (!settings) {
    settings = await Settings.create({ 
      key: 'app_settings', 
      isMaintenanceMode: false,
      isChatbotMaintenanceMode: false
    });
  } else {
    // Ensure existing documents have both fields
    if (settings.isChatbotMaintenanceMode === undefined) {
      settings.isChatbotMaintenanceMode = false;
      await settings.save();
    }
  }
  return settings;
}

export async function GET() {
  try {
    await connectToDatabase(); // Ensure connection for all cases
    const settings = await ensureSettingsDocument(); // Ensure settings exist
    
    console.log('Fetched settings:', { 
      isMaintenanceMode: settings.isMaintenanceMode, 
      isChatbotMaintenanceMode: settings.isChatbotMaintenanceMode 
    });

    return NextResponse.json({ 
      isMaintenanceMode: settings.isMaintenanceMode,
      isChatbotMaintenanceMode: settings.isChatbotMaintenanceMode || false
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching maintenance mode:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { isMaintenanceMode, isChatbotMaintenanceMode } = await req.json();

    if (isMaintenanceMode !== undefined && typeof isMaintenanceMode !== 'boolean') {
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }

    if (isChatbotMaintenanceMode !== undefined && typeof isChatbotMaintenanceMode !== 'boolean') {
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }

    const settings = await ensureSettingsDocument();
    if (isMaintenanceMode !== undefined) {
      settings.isMaintenanceMode = isMaintenanceMode;
    }
    if (isChatbotMaintenanceMode !== undefined) {
      settings.isChatbotMaintenanceMode = isChatbotMaintenanceMode;
    }
    
    console.log('Saving settings:', { 
      isMaintenanceMode: settings.isMaintenanceMode, 
      isChatbotMaintenanceMode: settings.isChatbotMaintenanceMode 
    });
    
    await settings.save();
    
    console.log('Settings saved:', { 
      isMaintenanceMode: settings.isMaintenanceMode, 
      isChatbotMaintenanceMode: settings.isChatbotMaintenanceMode 
    });

    return NextResponse.json({ 
      isMaintenanceMode: settings.isMaintenanceMode,
      isChatbotMaintenanceMode: settings.isChatbotMaintenanceMode || false
    });
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
