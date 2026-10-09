package com.aspen.yoinkit

import java.io.File

internal object YtDlpTemplates {
    fun scanOutput(directory: File): String =
        File(directory, "%(autonumber)02d.%(ext)s").absolutePath
}
