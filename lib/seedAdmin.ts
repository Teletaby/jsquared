// j-squared-cinema/lib/seedAdmin.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { connectToDatabase } from './mongodb';
import { User } from './models';
import bcrypt from 'bcrypt';

async function seedAdmin() {
  try {
    await connectToDatabase();

    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'admin123'; // This will be hashed

    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      console.log('Admin user already exists:', adminUser.email);
      // Optionally update password or role if needed
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        await adminUser.save();
        console.log('Admin user role updated to admin.');
      }
      // If the password is not hashed or needs updating, uncomment and modify below
      // const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password || '');
      // if (!isPasswordValid) {
      //   const hashedPassword = await bcrypt.hash(adminPassword, 10);
      //   adminUser.password = hashedPassword;
      //   await adminUser.save();
      //   console.log('Admin user password updated.');
      // }
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      adminUser = await User.create({
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        provider: 'credentials',
      });
      console.log('Admin user created successfully:', adminUser.email);
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    // In a Next.js app, the connection might be managed differently,
    // but for a standalone script, it's good practice to close.
    // mongoose.connection.close(); // Only if not running within a persistent connection context
  }
}

seedAdmin().catch(console.error);
