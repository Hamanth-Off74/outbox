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
      // Never redirect browser to API route endpoints
      if (url.includes('/api/auth')) {
        return `${baseUrl}/dashboard`;
      }
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === baseUrl && !url.includes('/api/auth')) {
          return url;
        }
      } catch (err) {
        // Safe fallback
      }
      return `${baseUrl}/dashboard`;
    },
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };
