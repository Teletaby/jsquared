import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';
import bcrypt from 'bcrypt';
import { JWT } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing email or password');
          return null;
        }

        try {
          await connectToDatabase();

          const user = await User.findOne({ email: credentials.email });
          console.log('User found:', user ? user.email : 'NOT FOUND');

          if (!user || !user.password) {
            console.log('User not found or no password set');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          console.log('Password valid:', isPasswordValid);

          if (!isPasswordValid) {
            console.log('Password invalid');
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role, // Add the user's role
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      try {
        await connectToDatabase();

        if (account?.provider === 'google') {
          const existingUser = await User.findOne({ email: user.email });

          if (!existingUser) {
            await User.create({
              email: user.email,
              name: user.name,
              image: user.image,
              googleId: account.providerAccountId,
              provider: 'google',
              role: 'user', // Default role for Google sign-in
            });
          }
           else if (existingUser && !existingUser.provider) {
            // Link existing credentials user to Google if they sign in with Google
            existingUser.googleId = account.providerAccountId;
            existingUser.provider = 'google';
            await existingUser.save();
          }
        }

        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    },
    async jwt({ token, user, trigger, session }: { token: JWT; user?: any; trigger?: 'signIn' | 'signUp' | 'update'; session?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.image = user.image; // Add image to token on sign in
      }
      if (trigger === 'update' && session?.user) {
        token.name = session.user.name;
        token.email = session.user.email;
        token.image = session.user.image;
        token.role = session.user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        
        // Fetch fresh user data from database to get latest image
        try {
          await connectToDatabase();
          const dbUser = await User.findById(token.id);
          if (dbUser) {
            session.user.image = dbUser.image; // Always use the latest image from DB
          } else {
            session.user.image = token.image as string;
          }
        } catch (error) {
          console.error('Error fetching user in session callback:', error);
          session.user.image = token.image as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
