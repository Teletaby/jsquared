const Footer = () => {
  return (
    <footer className="bg-ui-elements p-8 mt-8">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Copyright */}
          <div className="text-center md:text-left text-gray-400">
            <p>&copy; {new Date().getFullYear()} J-Squared Cinema. All Rights Reserved.</p>
          </div>

          {/* Legal Notice */}
          <div className="text-center md:text-right text-gray-500 text-sm">
            <p className="mb-2">
              <strong>Important Notice:</strong> J-Squared Cinema does not host or store any media files. 
              All content is sourced from third-party services and platforms. We respect intellectual property rights 
              and comply with DMCA regulations.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 pt-4">
          <p className="text-center text-gray-600 text-xs">
            If you believe any content violates your copyright, please contact us immediately.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
