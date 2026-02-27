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
            // DO NOT include image here — it can be a huge base64 string
            // that bloats the JWT cookie past HTTP header limits (HTTP 431).
            // Images are fetched from DB in the session callback instead.
            role: user.role,
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
      }
      // Always strip image/picture from token to keep cookies small.
      // NextAuth auto-populates these from the user object.
      delete token.image;
      delete token.picture;
      delete (token as any).photo;
      if (trigger === 'update' && session?.user) {
        token.name = session.user.name;
        token.email = session.user.email;
        token.role = session.user.role;
      }
      // Always strip image/picture from token
      delete token.image;
      delete token.picture;
      delete (token as any).photo;
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        
        // Fetch fresh user data from database to get latest image
        // Image is NOT stored in the JWT token to keep cookies small
        try {
          await connectToDatabase();
          const dbUser = await User.findById(token.id);
          if (dbUser) {
            session.user.image = dbUser.image || null;
          } else {
            session.user.image = null;
          }
        } catch (error) {
          console.error('Error fetching user in session callback:', error);
          session.user.image = null;
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
