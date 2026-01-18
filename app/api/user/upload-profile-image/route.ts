import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.error('No session or email found');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    console.log('Uploading profile image for user:', session.user.email);

    await connectToDatabase();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file in formData');
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
    }

    // Convert file to base64 data URL with compression
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    console.log('Image size:', imageUrl.length, 'bytes');

    // Check if image is too large (MongoDB has a 16MB limit per document)
    if (imageUrl.length > 5000000) {
      console.error('Image too large:', imageUrl.length);
      return new Response(JSON.stringify({ error: 'Image too large. Please compress it.' }), { status: 413 });
    }

    console.log('Saving image to database for:', session.user.email);

    // Update user in database
    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      { image: imageUrl },
      { new: true }
    );

    console.log('User updated:', user?._id, 'Image saved successfully');

    if (!user) {
      console.error('User not found:', session.user.email);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    return new Response(JSON.stringify({ imageUrl, success: true }), { status: 200 });
  } catch (error) {
    console.error('Profile image upload error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), { status: 500 });
  }
}
