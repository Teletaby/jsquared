"use client";

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Transition } from '@headlessui/react';
import { Bars3Icon } from '@heroicons/react/24/solid';
import { Search } from 'lucide-react'; // Added Search icon
import SearchModal from './SearchModal';

const navItems = [
  { name: 'Movies', href: '/movies' },
  { name: 'TV Shows', href: '/tv' },
];

const Header = () => {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <header className="bg-gray-900 text-white shadow-md top-0 z-60" style={{ position: 'relative' }}>
        <div className="container mx-auto flex justify-between items-center p-4">
          <Link href="/" className="text-2xl font-bold text-blue-500 tracking-wider">
            J-Squared Cinema
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 items-center">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href} className={`text-lg transition-colors duration-200 ${pathname === item.href ? 'text-blue-500 font-semibold' : 'text-gray-300 hover:text-blue-500'}`}>
                {item.name}
              </Link>
            ))}
            <button onClick={() => setIsSearchOpen(true)} className="text-lg text-gray-300 hover:text-blue-500 transition-colors duration-200"><Search size={24} /></button>
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
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => setIsSearchOpen(true)}
                          className={`${
                            active ? 'bg-blue-500 text-white' : 'text-gray-200'
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors duration-150`}
                        >
                          <Search size={24} />
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