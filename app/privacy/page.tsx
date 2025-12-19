// j-squared-cinema/app/privacy/page.tsx
import Link from 'next/link';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-6 text-center">Privacy Policy</h1>
          <p className="mb-6 text-gray-300">
            Your privacy is important to us. It is J-Squared Cinema&apos;s policy to respect your privacy regarding any information we may collect from you across our website, and other sites we own and operate.
          </p>

          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <p className="mb-4 text-gray-300">
            We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we&apos;re collecting it and how it will be used.
          </p>
          <p className="mb-6 text-gray-300">
            The information we collect may include your name, email address, and viewing preferences, which are used to personalize your experience and provide you with relevant content recommendations.
          </p>

          <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
          <p className="mb-4 text-gray-300">
            We use the information we collect in various ways, including to:
          </p>
          <ul className="list-disc list-inside mb-6 text-gray-300 space-y-2">
            <li>Provide, operate, and maintain our website</li>
            <li>Improve, personalize, and expand our website</li>
            <li>Understand and analyze how you use our website</li>
            <li>Develop new products, services, features, and functionality</li>
            <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes</li>
            <li>Find and prevent fraud</li>
          </ul>

          <h2 className="text-2xl font-semibold mb-4">3. Log Files</h2>
          <p className="mb-6 text-gray-300">
            J-Squared Cinema follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services&apos; analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users&apos; movement on the website, and gathering demographic information.
          </p>
          
          <h2 className="text-2xl font-semibold mb-4">4. Security</h2>
          <p className="mb-6 text-gray-300">
            We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we&apos;ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.
          </p>

          <h2 className="text-2xl font-semibold mb-4">5. Your Consent</h2>
          <p className="mb-6 text-gray-300">
            By using our website, you hereby consent to our Privacy Policy and agree to its terms.
          </p>

          <div className="text-center mt-8">
            <Link href="/signin" className="text-indigo-500 hover:underline">
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
