package com.aspen.yoinkit

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImageCandidateSelectorTest {

    private fun format(url: String, ext: String, width: Int = 0, height: Int = 0) =
        JSONObject()
            .put("url", url)
            .put("ext", ext)
            .put("width", width)
            .put("height", height)

    private fun thumbnail(url: String, width: Int = 0, height: Int = 0) =
        JSONObject().put("url", url).put("width", width).put("height", height)

    @Test
    fun `carousel keeps one candidate per entry in order`() {
        val entries = listOf(
            JSONObject().put("formats", JSONArray().put(format("https://cdn/a1.jpg", "jpg", 1080, 1080))),
            JSONObject().put("formats", JSONArray().put(format("https://cdn/a2.jpg", "jpg", 1080, 1350))),
            JSONObject().put("formats", JSONArray().put(format("https://cdn/a3.jpg", "jpg", 1080, 1920)))
        )

        val candidates = ImageCandidateSelector.selectAll(entries)

        assertEquals(3, candidates.size)
        assertEquals(listOf("https://cdn/a1.jpg", "https://cdn/a2.jpg", "https://cdn/a3.jpg"), candidates.map { it.url })
    }

    @Test
    fun `picks the largest image format and ignores video formats`() {
        val entry = JSONObject().put(
            "formats",
            JSONArray()
                .put(format("https://cdn/video.mp4", "mp4", 1920, 1080))
                .put(format("https://cdn/small.jpg", "jpg", 320, 320))
                .put(format("https://cdn/big.jpg", "jpg", 1440, 1440))
                .put(format("https://cdn/audio.m4a", "m4a"))
        )

        val best = ImageCandidateSelector.selectFrom(entry)

        assertEquals("https://cdn/big.jpg", best?.url)
        assertEquals(1440 * 1440, best?.area)
    }

    @Test
    fun `falls back to thumbnails when no image format exists`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/only-video.mp4", "mp4", 1920, 1080)))
            .put(
                "thumbnails",
                JSONArray()
                    .put(thumbnail("https://cdn/t640.jpg", 640, 640))
                    .put(thumbnail("https://cdn/t1080.jpg?stp=dst-jpg", 1080, 1350))
            )

        val best = ImageCandidateSelector.selectFrom(entry)

        assertEquals("https://cdn/t1080.jpg?stp=dst-jpg", best?.url)
        assertEquals(1080, best?.width)
        assertEquals(1350, best?.height)
        assertEquals("jpg", best?.ext)
    }

    @Test
    fun `media format wins over a larger thumbnail`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/original.png", "png", 1080, 1080)))
            .put("thumbnails", JSONArray().put(thumbnail("https://cdn/thumb.jpg", 4000, 4000)))

        assertEquals("https://cdn/original.png", ImageCandidateSelector.selectFrom(entry)?.url)
    }

    @Test
    fun `last thumbnail wins when dimensions are absent`() {
        val entry = JSONObject().put(
            "thumbnails",
            JSONArray()
                .put(thumbnail("https://cdn/small.jpg"))
                .put(thumbnail("https://cdn/large.webp"))
        )

        val best = ImageCandidateSelector.selectFrom(entry)

        assertEquals("https://cdn/large.webp", best?.url)
        assertEquals("webp", best?.ext)
        assertEquals(0, best?.area)
    }

    @Test
    fun `video only entry yields no candidate instead of throwing`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/video.mp4", "mp4", 1920, 1080)))
            .put("thumbnails", JSONArray())

        assertNull(ImageCandidateSelector.selectFrom(entry))
        assertTrue(ImageCandidateSelector.selectAll(listOf(entry)).isEmpty())
    }

    @Test
    fun `entry without any media metadata yields no candidate`() {
        assertNull(ImageCandidateSelector.selectFrom(JSONObject().put("id", "abc")))
    }

    @Test
    fun `jpeg and heif extensions are normalized`() {
        assertEquals("jpg", ImageCandidateSelector.normalizeExt("JPEG"))
        assertEquals("heic", ImageCandidateSelector.normalizeExt("heif"))
        assertTrue(ImageCandidateSelector.isImageExt("WEBP"))
        assertEquals(false, ImageCandidateSelector.isImageExt("mp4"))
        assertEquals(false, ImageCandidateSelector.isImageExt(null))
    }

    @Test
    fun `extension is inferred from url path ignoring query string`() {
        assertEquals("jpg", ImageCandidateSelector.extFromUrl("https://cdn/photo.jpg?stp=dst-jpg&x=1"))
        assertEquals("png", ImageCandidateSelector.extFromUrl("https://cdn/photo.PNG#frag"))
        assertEquals("jpg", ImageCandidateSelector.extFromUrl("https://cdn/photo"))
        assertEquals("jpg", ImageCandidateSelector.extFromUrl("https://cdn/noext"))
    }
}