// Bypass local certificate interception for Google API HTTPS requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      httpOptions: {
        timeout: 30000,
      },
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development-only-12345678',
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === baseUrl) return url;
      } catch (err) {
        // Safe fallback if URL parsing fails
      }
      return `${baseUrl}/dashboard`;
    },
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };
