import Navbar from '../components/Navbar'

const BasicPage = ({ title }) => {
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 font-serif">
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center px-6 py-28 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">MediCare</p>
        <h1 className="mt-3 text-4xl font-bold text-emerald-950 sm:text-5xl">{title}</h1>
      </main>
    </div>
  )
}

export default BasicPage
