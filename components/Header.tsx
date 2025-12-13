"use client";

import { Fragment, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import { Menu, Transition } from '@headlessui/react';
import { Bars3Icon } from '@heroicons/react/24/solid';
import { Search, UserCircle2, Settings } from 'lucide-react'; // Added Settings icon
import SearchModal from './SearchModal';
import { useAuth } from '@/lib/hooks/useAuth'; // Import the useAuth hook

const navItems = [
  { name: 'Movies', href: '/movies' },
  { name: 'TV Shows', href: '/tv' },
  { name: 'Upcoming', href: '/upcoming' },
];

const Header = () => {
  const pathname = usePathname();
  const router = useRouter(); // Initialize useRouter
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, loading, logout } = useAuth(); // Use the auth hook

  const handleAuthClick = () => {
    if (user) {
      router.push('/dashboard'); // Navigate to dashboard
    } else {
      router.push('/signin'); // Direct to signin
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-2xl text-white shadow-2xl border-b border-white/20">
        <div className="flex justify-between items-center p-3 sm:p-4 px-4 sm:px-8 max-w-full">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 text-lg sm:text-2xl font-bold text-blue-500 tracking-wider hover:opacity-80 transition-opacity">
            <Image
              src="/jsquare.png"
              alt="J-Squared Cinema Logo"
              width={32}
              height={32}
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
            <span className="hidden sm:inline">J-Squared Cinema</span>
            <span className="sm:hidden">J²</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 items-center">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href} className={`text-lg transition-colors duration-200 ${pathname === item.href ? 'text-blue-500 font-semibold' : 'text-gray-300 hover:text-blue-500'}`}>
                {item.name}
              </Link>
            ))}
            {!loading && (
              <>
                {user ? (
                  <Menu as="div" className="relative inline-block text-left">
                    <div>
                      <Menu.Button className="inline-flex w-full justify-center rounded-full p-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 overflow-hidden backdrop-blur transition-colors duration-200">
                        {user.image ? (
                          <Image
                            src={user.image}
                            alt={user.name || 'User'}
                            width={32}
                            height={32}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <UserCircle2 size={32} aria-hidden="true" />
                        )}
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-gray-800/90 backdrop-blur-lg shadow-lg ring-1 ring-white/20 focus:outline-none border border-white/10">
                        <div className="px-1 py-1 ">
                          <Menu.Item>
                            {({ active }) => (
                              <Link href="/dashboard"
                                className={`${
                                  active ? 'bg-blue-500 text-white' : 'text-gray-200'
                                } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                              >
                                Dashboard
                              </Link>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={logout}
                                className={`${
                                  active ? 'bg-blue-500 text-white' : 'text-gray-200'
                                } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                              >
                                Logout
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                ) : (
                  <button
                    onClick={handleAuthClick}
                    className="text-lg text-gray-300 hover:text-blue-500 transition-colors duration-200"
                    aria-label="Sign In / Sign Up"
                  >
                    <UserCircle2 size={24} />
                  </button>
                )}
                {user?.role === 'admin' && (
                  <Link href="/admin" className="text-lg text-gray-300 hover:text-blue-500 transition-colors duration-200" title="Admin Panel">
                    <Settings size={24} />
                  </Link>
                )}
                <button onClick={() => setIsSearchOpen(true)} className="text-lg text-gray-300 hover:text-blue-500 transition-colors duration-200"><Search size={24} /></button>
              </>
            )}
          </nav>

          {/* Mobile Menu Button and Dropdown */}
          <div className="md:hidden">
            <Menu as="div" className="relative inline-block text-left">
              <div>
                <Menu.Button className="inline-flex w-full justify-center rounded-md p-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75">
                  <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                </Menu.Button>
              </div>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-100"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-gray-800 shadow-lg ring-1 ring-black/5 focus:outline-none">
                  <div className="px-1 py-1">
                    {navItems.map((item) => (
                      <Menu.Item key={item.name}>
                        {({ active }) => (
                          <Link
                            href={item.href}
                            className={`${
                              active ? 'bg-blue-500 text-white' : pathname === item.href ? 'bg-blue-500/50 text-white' : 'text-gray-200'
                            } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                          >
                            {item.name}
                          </Link>
                        )}
                      </Menu.Item>
                    ))}
                    {user?.role === 'admin' && (
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href="/admin"
                            className={`${
                              active ? 'bg-blue-500 text-white' : 'text-gray-200'
                            } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                          >
                            <Settings size={24} className="mr-2" />
                            Admin Panel
                          </Link>
                        )}
                      </Menu.Item>
                    )}
                    {user ? (
                      <>
                        <Menu.Item>
                          {({ active }) => (
                            <Link href="/dashboard"
                              className={`${
                                active ? 'bg-blue-500 text-white' : 'text-gray-200'
                              } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                            >
                              <UserCircle2 size={24} className="mr-2" />
                              Dashboard
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={logout}
                              className={`${
                                active ? 'bg-blue-500 text-white' : 'text-gray-200'
                              } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                            >
                              <UserCircle2 size={24} className="mr-2" />
                              Logout
                            </button>
                          )}
                        </Menu.Item>
                      </>
                    ) : (
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleAuthClick}
                            className={`${
                              active ? 'bg-blue-500 text-white' : 'text-gray-200'
                            } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                          >
                            <UserCircle2 size={24} className="mr-2" />
                            Sign In / Sign Up
                          </button>
                        )}
                      </Menu.Item>
                    )}
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => setIsSearchOpen(true)}
                          className={`${
                            active ? 'bg-blue-500 text-white' : 'text-gray-200'
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                        >
                          <Search size={24} className="mr-2" />
                          Search
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </header>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default Header;