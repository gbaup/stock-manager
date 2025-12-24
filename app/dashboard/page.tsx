import { deleteSession } from '@/app/lib/auth';
import { redirect } from 'next/navigation';

export default function DashboardPage() {
    async function logout() {
        'use server';
        await deleteSession();
        redirect('/login');
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <form action={logout}>
                        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold">
                            Logout
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                        <h2 className="text-xl font-semibold mb-2 text-gray-200">Inventory</h2>
                        <p className="text-gray-400">Manage your football jerseys stock.</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                        <h2 className="text-xl font-semibold mb-2 text-gray-200">Catalog</h2>
                        <p className="text-gray-400">View and edit product catalog.</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                        <h2 className="text-xl font-semibold mb-2 text-gray-200">Sales</h2>
                        <p className="text-gray-400">Track your sales history.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
