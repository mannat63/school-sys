$files = Get-ChildItem -Path 'c:\Users\manna\Desktop\school-sys\app\(dashboard)' -Filter '*.js' -Recurse

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $newContent = $content `
        -replace 'rounded-xl shadow-sm overflow-hidden', 'rounded-2xl overflow-hidden' `
        -replace 'border border-gray-200 rounded-xl', 'border border-gray-100 rounded-2xl' `
        -replace 'border-gray-200 rounded-xl shadow-sm', 'border-gray-100 rounded-2xl' `
        -replace 'border border-gray-200 rounded-lg', 'border border-gray-100 rounded-2xl' `
        -replace 'rounded-xl p-4 shadow-sm', 'rounded-2xl p-5' `
        -replace 'bg-slate-800', 'bg-gray-900' `
        -replace 'hover:bg-slate-900', 'hover:bg-gray-800' `
        -replace 'text-xl font-bold text-slate-900', 'text-2xl font-bold text-gray-900' `
        -replace 'shadow-sm overflow-hidden', 'overflow-hidden'
    
    if ($content -ne $newContent) {
        Set-Content $f.FullName -Value $newContent -NoNewline
        Write-Host "Updated: $($f.Name)"
    }
}
